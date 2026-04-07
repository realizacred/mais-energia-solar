// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDevToolsContext } from "@/contexts/DevToolsContext";
import { buildGenerationAuditReport, shouldBlockGeneration, type GenerationAuditReport } from "@/services/generationAudit";
import { formatNumberBR } from "@/lib/formatters";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MapPin, User, BarChart3, Settings2,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu, Link2, ClipboardList, Box,
  Zap, AlertTriangle, Phone, Save, CheckCircle2,
  SunMedium, LayoutGrid, HardHat, Calculator, Wallet, ClipboardCheck, ScrollText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";
import { useProposalTemplates } from "@/hooks/useProposalTemplates";
import { cn } from "@/lib/utils";
import { useSolarPremises } from "@/hooks/useSolarPremises";
import { useProposalEnforcement } from "@/hooks/useProposalEnforcement";
import {
  useEquipmentCatalog, useBancosCatalog, useSolarBrainSync,
  useTenantTarifas, useCustomFieldsAvailability, applyTenantTarifasToUC,
} from "./wizard/useWizardDataLoaders";
import { validateGrupoConsistency, resolveGrupoFromSubgrupo } from "@/lib/validateGrupoConsistency";
import { enrichKitWarranties } from "@/services/enrichKitWarranties";
import type { ProposalResolverContext, TariffVersionContext } from "@/lib/resolveProposalVariables";

// ── Step Components
import { StepLocalizacao } from "./wizard/StepLocalizacao";
import { StepCliente } from "./wizard/StepCliente";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepCamposCustomizados } from "./wizard/StepCamposCustomizados";
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepAdicionais, type AdicionalItem } from "./wizard/StepAdicionais";
import { StepServicos } from "./wizard/StepServicos";
import { StepVenda } from "./wizard/StepVenda";
import { calcPrecoFinal, validateKit } from "./wizard/types";
import { calcFinancialSeries, flattenFinancialToSnapshot } from "./wizard/utils/calcFinancialSeries";
import { usePrecoFinal } from "@/hooks/usePrecoFinal";
import { validatePropostaFinal, type PropostaFinalValidationResult } from "./wizard/validatePropostaFinal";
import { PreGenerationGateModal } from "./wizard/PreGenerationGateModal";
import { StepFinancialCenter } from "./wizard/StepFinancialCenter";
import { savePricingHistory } from "./wizard/hooks/usePricingDefaults";
import { useWizardPersistence, type WizardSnapshot, type PersistenceParams, type AtomicPersistResult } from "./wizard/hooks/useWizardPersistence";
import { useWizardLocalDraft } from "./wizard/hooks/useWizardLocalDraft";
import { usePaymentInterestConfigs } from "@/hooks/usePaymentInterestConfig";
import { useDealCustomFieldValues } from "@/hooks/useDealCustomFieldValues";
import { useSaveDealCustomFieldValues } from "@/hooks/useSaveDealCustomFieldValues";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepResumo } from "./wizard/StepResumo";
import { StepDocumento } from "./wizard/StepDocumento";
import { DialogPosDimensionamento } from "./wizard/DialogPosDimensionamento";
import { ProposalAuditPanel } from "./wizard/ProposalAuditPanel";
import { WizardSidebar, type WizardStep } from "./wizard/WizardSidebar";
import { WizardStepCard } from "./wizard/WizardStepCard";
import { useSavedFeedback, SavedFeedbackInline } from "./wizard/SavedFeedback";
import { EstimativaCheckbox } from "./wizard/EstimativaCheckbox";
import { MissingVariablesModal } from "./wizard/MissingVariablesModal";
import { useIsAdminOrGerente } from "@/hooks/useReabrirProposta";

// ── Types
import {
  type LeadSelection, type ClienteData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type BancoFinanciamento, type PreDimensionamentoData,
  type LayoutArranjo,
  EMPTY_CLIENTE, DEFAULT_PREMISSAS, DEFAULT_PRE_DIMENSIONAMENTO, createEmptyUC, formatBRL,
  redeAtendimentoToFaseTensao, mapLeadTipoTelhadoToProposal,
} from "./wizard/types";

// ─── Step Keys ─────────────────────────────────────────────

const STEP_KEYS = {
  LOCALIZACAO: "localizacao",
  UCS: "ucs",
  CAMPOS_PRE: "campos_pre",
  KIT: "kit",
  ADICIONAIS: "adicionais",
  SERVICOS: "servicos",
  VENDA: "venda",
  PAGAMENTO: "pagamento",
  RESUMO: "resumo",
  PROPOSTA: "proposta",
} as const;

const BASE_STEPS: WizardStep[] = [
  { key: STEP_KEYS.LOCALIZACAO, label: "Localização", icon: MapPin },
  { key: STEP_KEYS.UCS, label: "Unidades Consumidoras", icon: Zap },
  { key: STEP_KEYS.CAMPOS_PRE, label: "Campos Customizados", icon: ClipboardList, conditional: true },
  { key: STEP_KEYS.KIT, label: "Kit Gerador", icon: SunMedium },
  { key: STEP_KEYS.ADICIONAIS, label: "Adicionais", icon: LayoutGrid },
  { key: STEP_KEYS.SERVICOS, label: "Serviços", icon: HardHat },
  { key: STEP_KEYS.VENDA, label: "Custos e Margem", icon: Calculator },
  { key: STEP_KEYS.PAGAMENTO, label: "Formas de pagamento", icon: Wallet },
  { key: STEP_KEYS.RESUMO, label: "Resumo", icon: ClipboardCheck },
  { key: STEP_KEYS.PROPOSTA, label: "Proposta", icon: ScrollText },
];

/** Step card metadata — title + helper text for each step */
const STEP_META: Record<string, { title: string; description: string }> = {
  [STEP_KEYS.LOCALIZACAO]: { title: "Localização e Cliente", description: "Defina o endereço do projeto e selecione o cliente ou lead." },
  [STEP_KEYS.UCS]: { title: "Unidades Consumidoras", description: "Configure as UCs, tarifas e dimensionamento do sistema." },
  [STEP_KEYS.CAMPOS_PRE]: { title: "Campos Customizados", description: "Preencha os campos adicionais configurados para sua empresa." },
  [STEP_KEYS.KIT]: { title: "Kit Gerador", description: "Monte o kit com módulos, inversores e demais equipamentos." },
  [STEP_KEYS.ADICIONAIS]: { title: "Itens Adicionais", description: "Adicione baterias, otimizadores e outros componentes extras." },
  [STEP_KEYS.SERVICOS]: { title: "Serviços", description: "Configure mão de obra, frete e serviços inclusos ou extras." },
  [STEP_KEYS.VENDA]: { title: "Custos e Margem", description: "Consolide custos do kit, serviços e comissão para definir o preço final." },
  [STEP_KEYS.PAGAMENTO]: { title: "Formas de Pagamento", description: "Configure opções de pagamento, financiamentos e parcelamentos." },
  [STEP_KEYS.RESUMO]: { title: "Resumo da Proposta", description: "Revise todos os dados antes de gerar a proposta comercial." },
  [STEP_KEYS.PROPOSTA]: { title: "Gerar Proposta", description: "Revise os dados e gere o documento final da proposta comercial." },
};

/**
 * Generate a NEW unique idempotency key for every generation attempt.
 * Key includes leadId for traceability but is always unique (UUID).
 * This prevents reuse of cached generation results when editing.
 */
function generateIdempotencyKey(_leadId: string): string {
  return crypto.randomUUID();
}

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────

export function ProposalWizard() {
  
  const navigate = useNavigate();
  const { data: isAdminOrGerente } = useIsAdminOrGerente();
  const [searchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get("deal_id");
  const customerIdFromUrl = searchParams.get("customer_id");
  const leadIdFromUrl = searchParams.get("lead_id");
  const orcIdFromUrl = searchParams.get("orc_id");
  const propostaIdFromUrl = searchParams.get("proposta_id");
  const versaoIdFromUrl = searchParams.get("versao_id");
  const [step, setStep] = useState(0);
  const [projectContext, setProjectContext] = useState<{ dealId: string; customerId: string } | null>(null);

  // ─── Custom fields availability (extracted hook)
  const { hasCustomFieldsPre } = useCustomFieldsAvailability();
  const { data: proposalTemplates = [] } = useProposalTemplates();
  const { data: solarPremises } = useSolarPremises();
  const { data: paymentInterestConfigs } = usePaymentInterestConfigs();
  const formasPagamentoProprias = useMemo(
    () => (paymentInterestConfigs ?? []).filter(c => c.ativo),
    [paymentInterestConfigs]
  );

  // ─── Dynamic steps based on custom fields
  const activeSteps = useMemo(() => {
    return BASE_STEPS.filter(s => {
      if (s.key === STEP_KEYS.CAMPOS_PRE) return hasCustomFieldsPre;
      return true;
    });
  }, [hasCustomFieldsPre]);

  const currentStepKey = activeSteps[step]?.key || STEP_KEYS.LOCALIZACAO;

  // Step 0 - Localização
  const [locEstado, setLocEstado] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locTipoTelhado, setLocTipoTelhado] = useState("");
  const [locDistribuidoraId, setLocDistribuidoraId] = useState("");
  const [locDistribuidoraNome, setLocDistribuidoraNome] = useState("");
  const [locIrradiacao, setLocIrradiacao] = useState<number>(0);
  const [locGhiSeries, setLocGhiSeries] = useState<Record<string, number> | null>(null);
  const [locSkipPoa, setLocSkipPoa] = useState(true);
  const [locLatitude, setLocLatitude] = useState<number | null>(null);
  const [mapSnapshots, setMapSnapshots] = useState<string[]>([]);
  const [distanciaKm, setDistanciaKm] = useState<number>(0);
  const [projectAddress, setProjectAddress] = useState<import("./wizard/ProjectAddressFields").ProjectAddress>({
    cep: "", rua: "", numero: "", complemento: "",
    bairro: "", cidade: "", uf: "", lat: null, lon: null,
  });

  // Cliente (embedded in Localização flow)
  const [selectedLead, setSelectedLead] = useState<LeadSelection | null>(null);
  const [cliente, setCliente] = useState<ClienteData>(EMPTY_CLIENTE);
  const [clienteMunicipioIbgeCodigo, setClienteMunicipioIbgeCodigo] = useState<string | null>(null);

  // UCs
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [ucsRestoreEpoch, setUcsRestoreEpoch] = useState(0);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Custom Fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Premissas
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Kit (extracted hooks)
  const { modulos, inversores, otimizadores, baterias, loadingEquip } = useEquipmentCatalog();
  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);
  const [manualKits, setManualKits] = useState<{ card: any; itens: KitItemRow[] }[]>([]);

  // Layouts
  const [layouts, setLayouts] = useState<LayoutArranjo[]>([]);

  // Adicionais
  const [adicionais, setAdicionais] = useState<AdicionalItem[]>([]);

  // Serviços
  const [servicos, setServicos] = useState<ServicoItem[]>([]);

  // Venda
  const [venda, setVenda] = useState<VendaData>({
    custo_kit: 0, custo_instalacao: 0, custo_comissao: 0, custo_outros: 0,
    margem_percentual: 20, desconto_percentual: 0, observacoes: "",
  });

  // Sync catalog kit fixed_price → venda.custo_kit_override
  // When items have 0 unit_price but kit has a known cost from meta
  useEffect(() => {
    if (manualKits.length === 0) return;
    const meta = (manualKits[0] as any)?.meta;
    if (!meta?.custo || meta.custo <= 0) return;
    const calculatedFromItems = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    // Only set override when items cost is significantly lower than meta cost
    if (calculatedFromItems < meta.custo * 0.99 && venda.custo_kit_override !== meta.custo) {
      setVenda(prev => ({ ...prev, custo_kit_override: meta.custo }));
    }
  }, [manualKits, itens]);

  const [pagamentoOpcoes, setPagamentoOpcoes] = useState<PagamentoOpcao[]>([]);
  const { bancos, loadingBancos } = useBancosCatalog();

  // Proposta (Documento)
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  // Persisted artifact paths (from storage)
  const [outputDocxPath, setOutputDocxPath] = useState<string | null>(null);
  const [outputPdfPath, setOutputPdfPath] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "calculating" | "generating_docx" | "converting_pdf" | "saving" | "ready" | "docx_only" | "error">("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [generationAuditReport, setGenerationAuditReport] = useState<GenerationAuditReport | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [preDimensionamento, setPreDimensionamento] = useState<PreDimensionamentoData>(DEFAULT_PRE_DIMENSIONAMENTO);

  // Pos-dimensionamento dialog
  const [showPosDialog, setShowPosDialog] = useState(false);
  const [nomeProposta, setNomeProposta] = useState("");

  // ─── Enforcement: block modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState<"missing_required" | "estimativa_not_accepted">("missing_required");
  const [blockMissing, setBlockMissing] = useState<string[]>([]);
  const [descricaoProposta, setDescricaoProposta] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  // ─── Pre-generation gate state
  const [showGateModal, setShowGateModal] = useState(false);
  const [gateValidation, setGateValidation] = useState<PropostaFinalValidationResult | null>(null);

  // ─── Navigation guard: warn user during generation ───
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = generating;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isGeneratingRef.current) {
        e.preventDefault();
        e.returnValue = "A proposta está sendo gerada. Se você sair, a geração pode ser interrompida.";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ─── Derived
  // J1 — SSOT: use usePrecoFinal hook instead of inline useMemo
  const precoFinal = usePrecoFinal(itens, servicos, venda);
  if (precoFinal === 0 && itens.length > 0) {
    console.warn("[precoFinal] R$ 0,00 com itens:", itens.map(i => ({ nome: i.descricao, qty: i.quantidade, preco: i.preco_unitario })));
  }
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // Prioridade: topologia do kit selecionado → fallback "tradicional"
  // Sem kit → sempre "tradicional"; com kit → topologia do kit
  const temKit = itens.length > 0;
  const topologiaDoKit = temKit
    ? (manualKits[0]?.card?.topologia?.toLowerCase() ?? null)
    : null;
  const topologiaAtiva = topologiaDoKit || "tradicional";
  const fatorGeracaoAtivo =
    preDimensionamento.topologia_configs?.[topologiaAtiva]?.fator_geracao ??
    preDimensionamento.fator_geracao ??
    0;

  // Estimated generation (kWh/month) — prefer SSOT from premissas/topologia
  const geracaoMensalEstimada = useMemo(() => {
    if (potenciaKwp <= 0) return 0;
    if (fatorGeracaoAtivo > 0) {
      return Math.round(potenciaKwp * fatorGeracaoAtivo);
    }
    if (locIrradiacao > 0) {
      const ucGeradora = ucs.find(u => u.is_geradora);
      const pr = (ucGeradora?.taxa_desempenho ?? 80) / 100;
      return Math.round(potenciaKwp * locIrradiacao * 30 * pr);
    }
    return 0;
  }, [potenciaKwp, fatorGeracaoAtivo, locIrradiacao, ucs]);

  // ─── Persistence: save draft / update
  const { persistAtomic, saving } = useWizardPersistence();
  const saveCustomFieldsMutation = useSaveDealCustomFieldValues();
  const [savedPropostaId, setSavedPropostaId] = useState<string | null>(null);
  const [savedVersaoId, setSavedVersaoId] = useState<string | null>(null);
  const [savedProjetoId, setSavedProjetoId] = useState<string | null>(null);
  const [savedDealId, setSavedDealId] = useState<string | null>(null);
  // Track if editing a previously sent/generated proposal (will branch new version)
  const [editingsentProposal, setEditingSentProposal] = useState(false);
  // Track async DB restore to block UI during loading (race condition fix)
  const [isRestoring, setIsRestoring] = useState(!!(propostaIdFromUrl && versaoIdFromUrl));

  // ─── Load deal custom field values as fallback for customFieldValues
  const effectiveDealId = savedDealId || (projectContext as any)?.dealId || null;
  const { data: dealFieldValues } = useDealCustomFieldValues(effectiveDealId);

  // Merge deal custom field values into customFieldValues (only for keys not already set)
  useEffect(() => {
    if (!dealFieldValues || Object.keys(dealFieldValues).length === 0) return;
    setCustomFieldValues(prev => {
      const merged = { ...prev };
      let changed = false;
      for (const [key, val] of Object.entries(dealFieldValues)) {
        if (val != null && val !== "" && (prev[key] === undefined || prev[key] === null || prev[key] === "")) {
          merged[key] = val;
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [dealFieldValues]);

  const collectSnapshot = useCallback((): WizardSnapshot => {
    // Recalculate pagamentoOpcoes with current precoFinal before saving.
    // When StepPagamento is unmounted its useEffect never reruns,
    // so à vista / financiamento values can be stale.
    const pagamentoOpcoesAtualizadas = pagamentoOpcoes.map(op => {
      if (op.tipo === "a_vista") {
        return {
          ...op,
          valor_financiado: precoFinal,
          entrada: precoFinal,
          valor_parcela: precoFinal,
          num_parcelas: 1,
        };
      }
      if (op.tipo === "financiamento" && precoFinal > 0) {
        return {
          ...op,
          valor_financiado: precoFinal,
        };
      }
      return op;
    });

    // ── Financial series enrichment (QW11) ──
    // Compute 25-year series, payback, TIR, VPL, economia before saving
    const ucGeradoraSnap = ucs.find(u => u.is_geradora) || ucs[0];
    const tarifaBaseSnap = ucGeradoraSnap?.tarifa_distribuidora || 0.80;
    const custoDispSnap = ucGeradoraSnap?.custo_disponibilidade_valor || 54.81;
    const consumoTotalSnap = ucs.reduce((s, u) => s + (u.consumo_mensal || (u.consumo_mensal_p || 0) + (u.consumo_mensal_fp || 0)), 0);

    let financialFields: Record<string, number> = {};
    if (precoFinal > 0 && potenciaKwp > 0) {
      const finResult = calcFinancialSeries({
        precoFinal,
        potenciaKwp,
        irradiacao: locIrradiacao,
        geracaoMensalKwh: geracaoMensalEstimada,
        consumoTotal: consumoTotalSnap,
        tarifaBase: tarifaBaseSnap,
        custoDisponibilidade: custoDispSnap,
        premissas,
      });
      financialFields = flattenFinancialToSnapshot(finResult);
    }

    return {
      locEstado,
      locCidade,
      locTipoTelhado,
      locDistribuidoraId,
      locDistribuidoraNome,
      locIrradiacao,
      locGhiSeries,
      locSkipPoa,
      locLatitude,
      distanciaKm,
      projectAddress,
      mapSnapshots,
      selectedLead,
      cliente,
      clienteMunicipioIbgeCodigo,
      ucs,
      grupo,
      potenciaKwp,
      customFieldValues: customFieldValues ?? {},
      premissas,
      preDimensionamento,
      itens,
      layouts,
      manualKits,
      adicionais,
      servicos,
      venda,
      pagamentoOpcoes: pagamentoOpcoesAtualizadas,
      nomeProposta: nomeProposta ?? "",
      descricaoProposta: descricaoProposta ?? "",
      templateSelecionado,
      step,
      geracaoMensalEstimada,
      // QW10 — top-level geração keys for backend resolvers
      geracao_mensal_kwh: geracaoMensalEstimada ?? 0,
      geracao_anual_kwh: (geracaoMensalEstimada ?? 0) * 12,
      // QW9 — consultor keys for backend resolvers
      consultor_nome: (selectedLead as any)?.consultor_nome
        ?? (selectedLead as any)?.responsavel_nome ?? "",
      consultor_email: (selectedLead as any)?.consultor_email ?? "",
      consultor_telefone: (selectedLead as any)?.consultor_telefone ?? "",
      // Formas de pagamento próprias (admin-configured) — embedded for public page
      formas_pagamento_proprias: formasPagamentoProprias,
      // QW12 — Cost fields for backend resolvers (passthrough)
      equipamentos_custo_total: venda.custo_kit ?? 0,
      instalacao_preco_total: venda.custo_instalacao ?? 0,
      instalacao_custo_total: venda.custo_instalacao ?? 0,
      kit_fechado_preco_total: venda.custo_kit ?? 0,
      kit_fechado_custo_total: venda.custo_kit ?? 0,
      kits_custo_total: venda.custo_kit ?? 0,
      // QW11 — Financial series (25-year), payback, TIR, VPL, economia
      ...financialFields,
    };
  }, [
    locEstado, locCidade, locTipoTelhado, locDistribuidoraId, locDistribuidoraNome,
    locIrradiacao, locGhiSeries, locSkipPoa, locLatitude, distanciaKm, projectAddress, mapSnapshots,
    selectedLead, cliente, clienteMunicipioIbgeCodigo, ucs, grupo, potenciaKwp,
    customFieldValues, premissas, preDimensionamento,
    itens, layouts, manualKits, adicionais, servicos, venda,
    pagamentoOpcoes, nomeProposta, descricaoProposta, templateSelecionado,
    step, geracaoMensalEstimada, formasPagamentoProprias, precoFinal,
  ]);

  // ─── Local draft: auto-save to localStorage on every state change
  const { persist: persistLocal, load: loadLocal, clear: clearLocal } = useWizardLocalDraft();
  const hasRestoredRef = useRef(false);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    if (!hasRestoredRef.current) return; // skip first render before restore
    const snapshot = collectSnapshot();
    persistLocal(snapshot, savedPropostaId, savedVersaoId);
  }, [collectSnapshot, persistLocal, savedPropostaId, savedVersaoId]);

  // ─── Helper: restore all wizard state from a WizardSnapshot ───
  // IMPORTANT: Use explicit != null checks (not truthy) to preserve falsy values like 0, "", false
  const restoreFromSnapshot = useCallback((s: WizardSnapshot) => {
    if (s.locEstado != null) setLocEstado(s.locEstado);
    if (s.locCidade != null) setLocCidade(s.locCidade);
    if (s.locTipoTelhado != null) setLocTipoTelhado(s.locTipoTelhado);
    if (s.locDistribuidoraId != null) setLocDistribuidoraId(s.locDistribuidoraId);
    if (s.locDistribuidoraNome != null) setLocDistribuidoraNome(s.locDistribuidoraNome);
    if (s.locIrradiacao != null) setLocIrradiacao(s.locIrradiacao);
    if (s.locGhiSeries != null) setLocGhiSeries(s.locGhiSeries);
    if (s.locSkipPoa != null) setLocSkipPoa(s.locSkipPoa);
    if (s.locLatitude != null) setLocLatitude(s.locLatitude);
    if (s.distanciaKm != null) setDistanciaKm(s.distanciaKm);
    if (s.projectAddress != null) setProjectAddress(s.projectAddress);
    if (s.mapSnapshots != null) setMapSnapshots(s.mapSnapshots);
    if (s.selectedLead != null) setSelectedLead(s.selectedLead);
    if (s.cliente != null) setCliente(s.cliente);
    if ((s as any).clienteMunicipioIbgeCodigo !== undefined) setClienteMunicipioIbgeCodigo((s as any).clienteMunicipioIbgeCodigo ?? null);
    // Also extract IBGE from selectedLead if available
    if (!((s as any).clienteMunicipioIbgeCodigo) && s.selectedLead?.municipio_ibge_codigo) {
      setClienteMunicipioIbgeCodigo(s.selectedLead.municipio_ibge_codigo);
    }
    // Fallback: snapshots antigos podem usar "unidades_consumidoras" em vez de "ucs"
    const ucsData = s.ucs ?? (s as any).unidades_consumidoras ?? null;
    if (Array.isArray(ucsData) && ucsData.length > 0) {
      // Merge defensivo: garante que campos novos tenham defaults em snapshots antigos
      setUcs(ucsData.map((u: UCData, i: number) => {
        const defaults = createEmptyUC(i);
        return {
          ...defaults,
          ...u,
          // Preservar tarifas do snapshot se > 0, senão manter default
          tarifa_distribuidora: u.tarifa_distribuidora || defaults.tarifa_distribuidora,
          tarifa_fio_b: u.tarifa_fio_b || defaults.tarifa_fio_b,
        };
      }));
      setUcsRestoreEpoch(e => e + 1);
    }
    if (s.grupo != null) setGrupo(s.grupo);
    if (s.potenciaKwp != null) setPotenciaKwp(s.potenciaKwp);
    if (s.customFieldValues != null) setCustomFieldValues(s.customFieldValues);
    if (s.premissas != null) setPremissas(s.premissas);
    if (s.preDimensionamento != null) setPreDimensionamento(s.preDimensionamento);
    if (s.itens != null) setItens(s.itens);
    if (s.layouts != null) setLayouts(s.layouts);
    if (s.manualKits != null) setManualKits(s.manualKits);
    if (s.adicionais != null) setAdicionais(s.adicionais);
    if (s.servicos != null) setServicos(s.servicos);
    if (s.venda != null) setVenda(s.venda);
    if (s.pagamentoOpcoes != null) setPagamentoOpcoes(s.pagamentoOpcoes);
    if (s.nomeProposta != null) setNomeProposta(s.nomeProposta);
    if (s.descricaoProposta != null) setDescricaoProposta(s.descricaoProposta);
    if (s.templateSelecionado != null) setTemplateSelecionado(s.templateSelecionado);
    // NOTE: Do NOT restore s.step here — edit mode always opens at step 0
    // to force the consultant to review all data from the beginning.
    // The step is still persisted in the snapshot for localStorage draft restore only.
  }, []);

  // Restore from localStorage on mount (only once, skip if loading from DB or project context)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    // If we have proposta_id + versao_id, the DB restore effect will handle it
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    // If opening from a project (deal/customer), skip localStorage — project data takes priority
    if (dealIdFromUrl || customerIdFromUrl) {
      hasRestoredRef.current = true;
      clearLocal();
      return;
    }
    hasRestoredRef.current = true;

    const draft = loadLocal();
    if (!draft?.snapshot) return;

    // If the draft belongs to an already-saved proposal, don't restore it
    // for a brand new wizard — the user expects a clean slate.
    if (draft.savedPropostaId) {
      clearLocal();
      return;
    }

    restoreFromSnapshot(draft.snapshot);
    // For localStorage drafts (new proposals), restore the step position
    if (draft.snapshot.step != null && draft.snapshot.step > 0) {
      setStep(draft.snapshot.step);
    }

    toast({ title: "📋 Rascunho restaurado", description: "O progresso anterior foi recuperado automaticamente." });
  }, [propostaIdFromUrl, versaoIdFromUrl, dealIdFromUrl, customerIdFromUrl, restoreFromSnapshot]);

  // ─── Normalize legacy (SolarMarket-imported) snapshots to WizardSnapshot format ───
  const normalizeLegacySnapshot = useCallback(async (
    raw: Record<string, any>,
    propostaId: string,
    versao: { potencia_kwp: number | null; valor_total: number | null; grupo: string | null }
  ): Promise<Partial<WizardSnapshot>> => {
    if (raw.source !== "legacy_import") return raw as any;

    // console.log("[ProposalWizard] Normalizing legacy snapshot for wizard");

    // Fetch related proposta → cliente data
    const { data: proposta } = await supabase
      .from("propostas_nativas")
      .select("titulo, cliente_id, lead_id, deal_id")
      .eq("id", propostaId)
      .maybeSingle();

    let clienteData: any = null;
    if (proposta?.cliente_id) {
      const { data } = await supabase
        .from("clientes")
        .select("nome, telefone, email, cpf_cnpj, empresa, cep, estado, cidade, bairro, rua, numero, complemento")
        .eq("id", proposta.cliente_id)
        .maybeSingle();
      clienteData = data;
    }

    // Map legacy fields to wizard format
    const normalized: Partial<WizardSnapshot> = {
      locEstado: clienteData?.estado || "",
      locCidade: clienteData?.cidade || "",
      locTipoTelhado: raw.roof_type || "",
      locDistribuidoraNome: raw.dis_energia || "",
      locDistribuidoraId: "",
      locIrradiacao: 0,
      locGhiSeries: null,
      locLatitude: null,
      distanciaKm: 0,
      projectAddress: clienteData ? {
        cep: clienteData.cep || "",
        rua: clienteData.rua || "",
        numero: clienteData.numero || "",
        bairro: clienteData.bairro || "",
        complemento: clienteData.complemento || "",
        cidade: clienteData.cidade || "",
        uf: clienteData.estado || "",
        lat: null,
        lon: null,
      } : undefined,
      mapSnapshots: [],
      cliente: clienteData ? {
        nome: clienteData.nome || "",
        celular: clienteData.telefone || "",
        email: clienteData.email || "",
        cnpj_cpf: clienteData.cpf_cnpj || "",
        empresa: clienteData.empresa || "",
      } : undefined,
      ucs: [{
        nome: "UC Principal",
        consumo_kwh: raw.consumo_mensal || 0,
        tipo_fase: "trifasico",
        grupo: versao.grupo || "B",
        subgrupo: "B3",
        tarifa_kwh: raw.tarifa_distribuidora || 0,
      }],
      grupo: versao.grupo || "B",
      potenciaKwp: versao.potencia_kwp || 0,
      itens: [
        ...(raw.panel_model ? [{
          tipo: "modulo",
          fabricante: "",
          modelo: raw.panel_model,
          potencia_w: 0,
          quantidade: raw.panel_quantity || 0,
          preco_unitario: 0,
          preco_total: 0,
        }] : []),
        ...(raw.inverter_model ? [{
          tipo: "inversor",
          fabricante: "",
          modelo: raw.inverter_model,
          potencia_w: 0,
          quantidade: raw.inverter_quantity || 1,
          preco_unitario: 0,
          preco_total: 0,
        }] : []),
      ],
      layouts: [],
      manualKits: [],
      adicionais: [],
      servicos: raw.installation_cost ? [{
        nome: "Mão de Obra / Instalação",
        valor: raw.installation_cost,
        tipo: "fixo",
      }] : [],
      venda: {
        custo_equipamentos: raw.equipment_cost || 0,
        custo_servicos: raw.installation_cost || 0,
        margem_percentual: 0,
        preco_final: versao.valor_total || 0,
      },
      pagamentoOpcoes: raw.payment_conditions ? [{ descricao: raw.payment_conditions }] : [],
      nomeProposta: proposta?.titulo || "",
      descricaoProposta: "",
      templateSelecionado: "",
      step: 0,
      premissas: null,
      preDimensionamento: null,
      customFieldValues: {},
    };

    return normalized;
  }, []);

  // ─── Restore from DB when proposta_id + versao_id in URL (edit mode) ───
  const restoreKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!propostaIdFromUrl || !versaoIdFromUrl) return;
    const restoreKey = `${propostaIdFromUrl}:${versaoIdFromUrl}`;
    if (restoreKeyRef.current === restoreKey) return;
    restoreKeyRef.current = restoreKey;
    setIsRestoring(true);

    (async () => {
      try {
        const { data: versao } = await supabase
          .from("proposta_versoes")
          .select("id, proposta_id, snapshot, potencia_kwp, valor_total, status, grupo, output_pdf_path, output_docx_path")
          .eq("id", versaoIdFromUrl)
          .single();

        if (!versao?.snapshot) {
          console.warn("[ProposalWizard] No snapshot found for versao", versaoIdFromUrl);
          // Still set IDs so handleUpdate won't create a new proposal
          setSavedPropostaId(propostaIdFromUrl);
          setSavedVersaoId(versaoIdFromUrl);
          setIsRestoring(false);
          return;
        }

        const rawSnapshot = versao.snapshot as unknown as Record<string, any>;

        // Detect snapshot format and normalize to wizard format
        let s: WizardSnapshot;
        if (rawSnapshot.source === "legacy_import") {
          // Legacy SolarMarket import
          s = await normalizeLegacySnapshot(rawSnapshot, propostaIdFromUrl, versao) as WizardSnapshot;
        } else if (rawSnapshot.engine_version || rawSnapshot.versao_schema) {
          // Engine-enriched snapshot — map back to wizard format
          const ws = rawSnapshot._wizard_state || {}; // Wizard state passthrough (v2.5+)
          const uc0 = (rawSnapshot.ucs as any[])?.[0] || {};
          const tecnico = rawSnapshot.tecnico || {};
          const fin = rawSnapshot.financeiro || {};
          const vendaEngine = rawSnapshot.venda || {};
          const premissasEngine = rawSnapshot.premissas || {};

          // Map engine itens back to KitItemRow format (restore fabricante, modelo, avulso, id)
          const rawEngineItens = (rawSnapshot.itens || []).map((it: any) => ({
            id: it.id || crypto.randomUUID(),
            descricao: it.descricao || "",
            fabricante: it.fabricante || "",
            modelo: it.modelo || "",
            potencia_w: Number(it.potencia_w) || 0,
            quantidade: Number(it.quantidade) || 0,
            preco_unitario: Number(it.preco_unitario) || 0,
            categoria: it.categoria || "outros",
            avulso: it.avulso ?? false,
            produto_ref: it.produto_ref || null,
          }));

          // Enrich with current warranty data from catalog (snapshot doesn't persist warranty fields)
          const engineItens = await enrichKitWarranties(rawEngineItens);

          // Map engine venda to wizard VendaData
          const ve = vendaEngine as Record<string, any>;
          const vendaMapped = {
            custo_kit: Number(ve.custo_kit) || 0,
            custo_instalacao: Number(ve.custo_instalacao) || 0,
            custo_comissao: Number(ve.custo_comissao) || 0,
            custo_outros: Number(ve.custo_outros) || 0,
            margem_percentual: Number(ve.margem_percentual) || 0,
            desconto_percentual: Number(ve.desconto_percentual) || 0,
            observacoes: ve.observacoes || "",
            // Campos adicionados após engine snapshot — preservar se existirem
            custo_kit_override: ve.custo_kit_override ?? null,
            comissao_manual_override: ve.comissao_manual_override ?? false,
            instalacao_enabled: ve.instalacao_enabled ?? true,
            comissao_enabled: ve.comissao_enabled ?? true,
            custos_extras: Array.isArray(ve.custos_extras) ? ve.custos_extras : [],
            servicos_enabled_map: ve.servicos_enabled_map ?? {},
            percentual_comissao_consultor: Number(ve.percentual_comissao_consultor) || 0,
            consultor_nome_comissao: ve.consultor_nome_comissao || "",
          };

          // ── Backfill venda fields lost by engine snapshot ──
          // First try: recover from servicos array in the SAME snapshot
          if (vendaMapped.custo_instalacao === 0) {
            const snapServicos = rawSnapshot?.servicos as any[];
            if (Array.isArray(snapServicos)) {
              const instServ = snapServicos.find(
                (s: any) => s.tipo === 'instalacao' || s.categoria === 'instalacao' ||
                  s.nome?.toLowerCase().includes('instala')
              );
              if (instServ?.valor > 0) {
                vendaMapped.custo_instalacao = Number(instServ.valor);
              }
            }
          }
          if (vendaMapped.custo_comissao === 0) {
            const snapServicos = rawSnapshot?.servicos as any[];
            if (Array.isArray(snapServicos)) {
              const comServ = snapServicos.find(
                (s: any) => s.tipo === 'comissao' || s.categoria === 'comissao' ||
                  s.nome?.toLowerCase().includes('comiss')
              );
              if (comServ?.valor > 0) {
                vendaMapped.custo_comissao = Number(comServ.valor);
              }
            }
          }

          // Second try: recover from previous versions
          if (vendaMapped.custo_instalacao === 0 || vendaMapped.custo_comissao === 0) {
            try {
              const { data: prevVersions } = await supabase
                .from("proposta_versoes")
                .select("snapshot")
                .eq("proposta_id", propostaIdFromUrl)
                .neq("id", versaoIdFromUrl)
                .order("created_at", { ascending: false })
                .limit(3);
              for (const pv of prevVersions || []) {
                const pvVenda = (pv.snapshot as any)?.venda;
                if (!pvVenda) continue;
                if (vendaMapped.custo_instalacao === 0 && Number(pvVenda.custo_instalacao) > 0) {
                  vendaMapped.custo_instalacao = Number(pvVenda.custo_instalacao);
                }
                if (vendaMapped.custo_comissao === 0 && Number(pvVenda.custo_comissao) > 0) {
                  vendaMapped.custo_comissao = Number(pvVenda.custo_comissao);
                }
                if (vendaMapped.custo_instalacao > 0 && vendaMapped.custo_comissao > 0) break;
              }
            } catch {
              // Non-critical — proceed with 0 if backfill fails
            }
          }

          // Map engine premissas to PremissasData
          const premissasMapped = {
            imposto: Number(premissasEngine.imposto) || 0,
            inflacao_energetica: Number(premissasEngine.inflacao_energetica) || 6.5,
            inflacao_ipca: Number(premissasEngine.inflacao_ipca) || 4.5,
            perda_eficiencia_anual: Number(premissasEngine.perda_eficiencia_anual) || 0.5,
            sobredimensionamento: Number(premissasEngine.sobredimensionamento) || 0,
            troca_inversor_anos: Number(premissasEngine.troca_inversor_anos) || 15,
            troca_inversor_custo: Number(premissasEngine.troca_inversor_custo) || 30,
            vpl_taxa_desconto: Number(premissasEngine.vpl_taxa_desconto) || 10,
          };

          // Map engine pagamento opcoes
          const pagOpcoes = (rawSnapshot.pagamento_opcoes || rawSnapshot.pagamentoOpcoes || []).map((p: any) => ({
            id: p.id || crypto.randomUUID(),
            nome: p.nome || "",
            tipo: p.tipo || "a_vista",
            valor_financiado: Number(p.valor_financiado) || 0,
            entrada: Number(p.entrada) || 0,
            taxa_mensal: Number(p.taxa_mensal) || 0,
            carencia_meses: Number(p.carencia_meses) || 0,
            num_parcelas: Number(p.num_parcelas) || 0,
            valor_parcela: Number(p.valor_parcela) || 0,
          }));

          // Map engine servicos to wizard ServicoItem format
          const servicosMapped = (rawSnapshot.servicos || []).map((sv: any) => ({
            id: sv.id || crypto.randomUUID(),
            descricao: sv.descricao || "",
            categoria: sv.categoria || "instalacao",
            valor: Number(sv.valor) || 0,
            incluso_no_preco: sv.incluso_no_preco ?? true,
          }));

          s = {
            locEstado: uc0.estado || "",
            locCidade: uc0.cidade || "",
            locTipoTelhado: uc0.tipo_telhado || "",
            locDistribuidoraId: ws.locDistribuidoraId || uc0.distribuidora_id || "",
            locDistribuidoraNome: uc0.distribuidora || "",
            locIrradiacao: tecnico.irradiacao_media_kwp_mes || 0,
            locGhiSeries: ws.locGhiSeries ?? null,
            locSkipPoa: ws.locSkipPoa ?? true,
            locLatitude: ws.locLatitude ?? rawSnapshot.locLatitude ?? (rawSnapshot.projectAddress?.lat != null ? rawSnapshot.projectAddress.lat : null),
            distanciaKm: uc0.distancia || rawSnapshot.distanciaKm || 0,
            projectAddress: ws.projectAddress ?? rawSnapshot.projectAddress ?? (uc0.cidade ? {
              cep: uc0.cep || "",
              rua: uc0.rua || uc0.logradouro || "",
              numero: uc0.numero || "",
              bairro: uc0.bairro || "",
              complemento: uc0.complemento || "",
              cidade: uc0.cidade || "",
              uf: uc0.estado || uc0.uf || "",
              lat: rawSnapshot.projectAddress?.lat ?? null,
              lon: rawSnapshot.projectAddress?.lon ?? null,
            } : undefined),
            mapSnapshots: rawSnapshot.mapSnapshots || [],
            selectedLead: ws.selectedLead ?? rawSnapshot.selectedLead ?? null,
            cliente: ws.cliente ?? rawSnapshot.cliente ?? undefined as any,
            ucs: rawSnapshot.ucs || rawSnapshot.unidades_consumidoras || [],
            grupo: rawSnapshot.ucs?.length > 1 ? "multi" : (uc0.subgrupo?.startsWith("A") ? "A" : "B1"),
            potenciaKwp: tecnico.potencia_kwp || versao.potencia_kwp || 0,
            itens: engineItens,
            layouts: ws.layouts || [],
            manualKits: ws.manualKits || [],
            adicionais: ws.adicionais || [],
            servicos: servicosMapped,
            venda: vendaMapped,
            premissas: premissasMapped,
            preDimensionamento: ws.preDimensionamento ?? {
              sistema: "on_grid",
              tipos_kit: ["customizado"],
              topologias: ["tradicional"],
              inclinacao: Number(uc0.inclinacao) || 20,
              desvio_azimutal: Number(uc0.desvio_azimutal) || 0,
              desempenho: Number(uc0.taxa_desempenho) || 80,
              fator_geracao: 0,
              fator_geracao_meses: {},
              sombreamento: "Nenhuma",
              dod: 0,
              topologia_configs: {},
              sobredimensionamento: Number(premissasEngine.sobredimensionamento) || 20,
              margem_pot_ideal: 0,
              considerar_transformador: true,
              tipo_kit: "customizado",
            } as any,
            pagamentoOpcoes: pagOpcoes,
            customFieldValues: ws.customFieldValues ?? rawSnapshot.variaveis_custom ?? {},
            nomeProposta: ws.nomeProposta ?? "",
            descricaoProposta: ws.descricaoProposta ?? "",
            templateSelecionado: ws.templateSelecionado ?? rawSnapshot.inputs?.template_id ?? "",
            step: 0,
            geracaoMensalEstimada: ws.geracaoMensalEstimada ?? (tecnico.geracao_estimada_kwh || fin.economia_mensal ? Math.round(tecnico.geracao_estimada_kwh || 0) : 0),
          } as any;
          // console.log("[ProposalWizard] Normalized engine snapshot to wizard format", { hasWizardState: !!rawSnapshot._wizard_state });
        } else {
          // Native wizard snapshot — use as-is, with safe defaults for fields added after initial save
          s = rawSnapshot as WizardSnapshot;

          // ── Normalização defensiva do snapshot nativo ──
          // Garante compatibilidade com snapshots antigos que não têm campos recentes
          try {
            // Arrays obrigatórios
            if (!Array.isArray(s.servicos)) (s as any).servicos = [];
            if (!Array.isArray(s.pagamentoOpcoes)) (s as any).pagamentoOpcoes = [];
            if (!Array.isArray(s.itens)) (s as any).itens = [];
            if (!Array.isArray(s.adicionais)) (s as any).adicionais = [];
            if (!Array.isArray(s.ucs)) (s as any).ucs = (s as any).unidades_consumidoras || [];
            if (!Array.isArray(s.layouts)) (s as any).layouts = [];
            if (!Array.isArray(s.manualKits)) (s as any).manualKits = [];
            if (!Array.isArray((s as any).formas_pagamento_proprias)) (s as any).formas_pagamento_proprias = [];

            // Objetos obrigatórios
            if (!s.customFieldValues) (s as any).customFieldValues = {};

            // VendaData — merge com defaults para campos novos
            const vendaDefaults = {
              custo_kit: 0,
              custo_instalacao: 0,
              custo_comissao: 0,
              custo_outros: 0,
              margem_percentual: 20,
              desconto_percentual: 0,
              observacoes: "",
              custo_kit_override: null,
              comissao_manual_override: false,
              instalacao_enabled: true,
              comissao_enabled: true,
              custos_extras: [],
              servicos_enabled_map: {},
              percentual_comissao_consultor: 0,
              consultor_nome_comissao: "",
            };
            (s as any).venda = {
              ...vendaDefaults,
              ...(s.venda && typeof s.venda === "object" ? s.venda : {}),
            };

            if (!s.premissas || typeof s.premissas !== "object") {
              (s as any).premissas = {
                imposto: 0,
                inflacao_energetica: 6.5,
                inflacao_ipca: 4.5,
                perda_eficiencia_anual: 0.5,
                sobredimensionamento: 0,
                troca_inversor_anos: 15,
                troca_inversor_custo: 30,
                vpl_taxa_desconto: 10,
              };
            }

            if (!s.preDimensionamento || typeof s.preDimensionamento !== "object") {
              (s as any).preDimensionamento = {
                topologias: ["tradicional"],
                topologia_configs: {
                  tradicional: { desempenho: 69.8, fator_geracao: 108 },
                  microinversor: { desempenho: 72, fator_geracao: 111 },
                  otimizador: { desempenho: 74, fator_geracao: 114 },
                },
                fator_geracao: 108,
                inclinacao: 20,
                desvio_azimutal: 0,
                sombreamento: "Nenhuma",
                sobredimensionamento: 20,
                tipo_kit: "customizado",
                tipos_kit: ["customizado"],
                sistema: "on_grid",
                desempenho: 80,
                dod: 0,
                fator_geracao_meses: {},
                margem_pot_ideal: 0,
                considerar_transformador: true,
              } as any;
            }
          } catch (normErr) {
            console.error("[ProposalWizard] Erro ao normalizar snapshot nativo:", normErr);
          }
          // ── Fim da normalização ──
        }

        // Diagnostic: log snapshot data for debugging restore issues
        // console.log("[ProposalWizard] Snapshot restore:", {
        //   ucs: s.ucs?.length ?? 0,
        //   ucsConsumo: s.ucs?.map((u: any) => ({ nome: u.nome, consumo_mensal: u.consumo_mensal })),
        //   itens: s.itens?.length ?? 0,
        //   itensDetail: s.itens?.map((i: any) => ({ descricao: i.descricao, qty: i.quantidade, preco: i.preco_unitario })),
        //   manualKits: s.manualKits?.length ?? 0,
        //   hasSelectedLead: !!s.selectedLead,
        //   potenciaKwp: s.potenciaKwp,
        // });
        // ── Sanitizar grupo_tarifario nas UCs restauradas ──
        // Snapshots antigos podem ter valores inválidos como "MT"/"BT" em vez de "A"/"B"
        if (Array.isArray(s.ucs)) {
          (s as any).ucs = s.ucs.map((uc: any) => {
            const g = uc.grupo_tarifario;
            if (g === "A" || g === "B") return uc;
            const resolved = resolveGrupoFromSubgrupo(uc.subgrupo);
            return { ...uc, grupo_tarifario: resolved || "B" };
          });
        }

        restoreFromSnapshot(s);

        // CRITICAL: Set IDs BEFORE releasing isRestoring
        // This prevents handleUpdate from falling into the "create new" path
        setSavedPropostaId(propostaIdFromUrl);
        setSavedVersaoId(versaoIdFromUrl);
        hasRestoredRef.current = true;

        // Clear localStorage draft to avoid conflicts
        clearLocal();

        // ── Enrich restore: fetch lead_id / deal_id from propostas_nativas
        // Snapshot may not contain selectedLead when proposal was created via project context
        try {
          const { data: propostaMeta } = await supabase
            .from("propostas_nativas")
            .select("lead_id, deal_id, projeto_id, cliente_id, status")
            .eq("id", propostaIdFromUrl)
            .single();

          // Detect if proposal was already sent/generated — will branch new version on save
          const SENT_STATUSES = ["enviada", "vista", "aceita", "gerada"];
          if (propostaMeta?.status && SENT_STATUSES.includes(propostaMeta.status)) {
            setEditingSentProposal(true);
          }

          if (propostaMeta?.deal_id) {
            setProjectContext(prev => prev || { dealId: propostaMeta.deal_id!, customerId: propostaMeta.cliente_id || "" });
            // console.log("[ProposalWizard] dealId enriched from propostas_nativas:", propostaMeta.deal_id);
          }

          if (propostaMeta?.projeto_id) {
            setSavedProjetoId(propostaMeta.projeto_id);
          }
          if (propostaMeta?.deal_id) {
            setSavedDealId(propostaMeta.deal_id);
          }

          // Enrich selectedLead if missing from snapshot
          if (!s.selectedLead) {
            if (propostaMeta?.lead_id) {
              const { data: lead } = await supabase
                .from("leads")
                .select("*")
                .eq("id", propostaMeta.lead_id)
                .single();
              if (lead) {
                setSelectedLead(lead as any);
                if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
                // console.log("[ProposalWizard] Lead enriched from propostas_nativas:", lead.id);
              }
            } else if (propostaMeta?.cliente_id) {
              // No lead_id on proposta — try to get lead from cliente, or synthesize from cliente data
              const { data: cli } = await supabase
                .from("clientes")
                .select("id, nome, telefone, email, lead_id, estado, cidade, municipio_ibge_codigo")
                .eq("id", propostaMeta.cliente_id)
                .maybeSingle();

              if (cli?.lead_id) {
                const { data: lead } = await supabase
                  .from("leads")
                  .select("*")
                  .eq("id", cli.lead_id)
                  .single();
                if (lead) {
                  setSelectedLead(lead as any);
                  if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
                  // console.log("[ProposalWizard] Lead enriched from cliente.lead_id:", lead.id);
                }
              } else if (cli) {
                // No lead_id on cliente — try to find a lead by phone number
                const phoneNorm = cli.telefone.replace(/\D/g, "");
                const { data: leadByPhone } = await supabase
                  .from("leads")
                  .select("*")
                  .eq("telefone_normalized", phoneNorm)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (leadByPhone) {
                  setSelectedLead(leadByPhone as any);
                  if (leadByPhone.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(leadByPhone.municipio_ibge_codigo);
                  // console.log("[ProposalWizard] Lead found by phone match:", leadByPhone.id);
                } else {
                  // Synthesize minimal lead-like object from cliente data so handleGenerate doesn't block
                  // Mark with _synthetic flag so handleGenerate can use cliente_id instead
                  const syntheticLead: LeadSelection = {
                    id: cli.id, // Use cliente ID — handleGenerate will detect synthetic via _synthetic flag
                    nome: cli.nome,
                    telefone: cli.telefone,
                    lead_code: "",
                    estado: cli.estado || s.locEstado || "",
                    cidade: cli.cidade || s.locCidade || "",
                    media_consumo: s.ucs?.[0]?.consumo_mensal || 0,
                    tipo_telhado: s.locTipoTelhado || "",
                    _synthetic: true,
                    _clienteId: cli.id,
                  } as any;
                  setSelectedLead(syntheticLead);
                  if (cli.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(cli.municipio_ibge_codigo);
                  // console.log("[ProposalWizard] Synthetic lead created from cliente:", cli.id);
                }
              }
            }
          }

          // Enrich cliente state if missing from snapshot
          if (!s.cliente?.nome && propostaMeta?.cliente_id) {
            const { data: cliEnrich } = await supabase
              .from("clientes")
              .select("nome, telefone, email, cpf_cnpj, empresa, cep, rua, numero, complemento, bairro, cidade, estado")
              .eq("id", propostaMeta.cliente_id)
              .maybeSingle();
            if (cliEnrich?.nome) {
              setCliente(prev => ({
                ...prev,
                nome: prev.nome || cliEnrich.nome || "",
                celular: prev.celular || cliEnrich.telefone || "",
                email: prev.email || cliEnrich.email || "",
                cnpj_cpf: prev.cnpj_cpf || cliEnrich.cpf_cnpj || "",
                empresa: prev.empresa || cliEnrich.empresa || "",
                cep: prev.cep || cliEnrich.cep || "",
                endereco: prev.endereco || cliEnrich.rua || "",
                numero: prev.numero || cliEnrich.numero || "",
                complemento: prev.complemento || cliEnrich.complemento || "",
                bairro: prev.bairro || cliEnrich.bairro || "",
                cidade: prev.cidade || cliEnrich.cidade || "",
                estado: prev.estado || cliEnrich.estado || "",
              }));
              // console.log("[ProposalWizard] cliente enriched from DB:", propostaMeta.cliente_id);
            }
          }

          // Enrich projectAddress from cliente if still empty after snapshot restore
          if (!s.projectAddress && propostaMeta?.cliente_id) {
            const { data: cliAddr } = await supabase
              .from("clientes")
              .select("cep, rua, numero, bairro, complemento, cidade, estado")
              .eq("id", propostaMeta.cliente_id)
              .maybeSingle();
            if (cliAddr && (cliAddr.cidade || cliAddr.rua || cliAddr.cep)) {
              setProjectAddress({
                cep: cliAddr.cep || "",
                rua: cliAddr.rua || "",
                numero: cliAddr.numero || "",
                bairro: cliAddr.bairro || "",
                complemento: cliAddr.complemento || "",
                cidade: cliAddr.cidade || "",
                uf: cliAddr.estado || "",
                lat: null,
                lon: null,
              });
              // console.log("[ProposalWizard] projectAddress enriched from cliente:", propostaMeta.cliente_id);
            }
          }
        } catch (enrichErr) {
          console.warn("[ProposalWizard] Failed to enrich lead/deal from propostas_nativas:", enrichErr);
        }

        // Restaurar preview do PDF se a versão já foi gerada
        const restoredPdfPath = (versao as any)?.output_pdf_path ?? null;
        const restoredDocxPath = (versao as any)?.output_docx_path ?? null;

        if (restoredPdfPath) {
          setOutputPdfPath(restoredPdfPath);
          setOutputDocxPath(restoredDocxPath);
          setGenerationStatus("ready");

          const { data: signedData } = await supabase.storage
            .from("proposta-documentos")
            .createSignedUrl(restoredPdfPath, 3600);

          if (signedData?.signedUrl) {
            setPdfBlobUrl(signedData.signedUrl);
          }
        } else if (restoredDocxPath) {
          setOutputPdfPath(null);
          setOutputDocxPath(restoredDocxPath);
          setGenerationStatus("ready");
        }

        const isLegacy = rawSnapshot.source === "legacy_import";
        toast({
          title: isLegacy ? "📋 Proposta importada carregada" : "📋 Proposta carregada",
          description: isLegacy
            ? "Dados do SolarMarket foram mapeados. Revise e complete os campos."
            : "Todos os dados foram restaurados do banco de dados.",
        });
      } catch (err) {
        console.error("[ProposalWizard] Error loading proposal from DB:", err);
        // Still set IDs on error to prevent duplicate creation
        setSavedPropostaId(propostaIdFromUrl);
        setSavedVersaoId(versaoIdFromUrl);
        toast({ title: "Erro ao carregar proposta", description: "Não foi possível restaurar os dados.", variant: "destructive" });
      } finally {
        setIsRestoring(false);
      }
    })();
  }, [propostaIdFromUrl, versaoIdFromUrl, restoreFromSnapshot, clearLocal, normalizeLegacySnapshot]);

  // dealIdFromUrl is a deals.id UUID — passed as deal_id to RPC (which resolves/creates projetos)
  const resolvedDealId = projectContext?.dealId || dealIdFromUrl || undefined;

  /** Build persistence params from current wizard state */
  const buildPersistParams = useCallback((
    overridePropostaId?: string | null,
    overrideVersaoId?: string | null,
  ): PersistenceParams => {
    const snapshot = collectSnapshot();
    const titulo = nomeProposta || cliente.nome || selectedLead?.nome || "Proposta";
    return {
      effectivePropostaId: overridePropostaId ?? savedPropostaId ?? null,
      effectiveVersaoId: overrideVersaoId ?? savedVersaoId ?? null,
      snapshot,
      potenciaKwp,
      precoFinal,
      economiaMensal: geracaoMensalEstimada > 0
        ? Math.round(geracaoMensalEstimada * (ucs.find(u => u.is_geradora)?.tarifa_distribuidora || 0.80))
        : undefined,
      geracaoMensal: geracaoMensalEstimada || undefined,
      leadId: (selectedLead as any)?._synthetic ? undefined : selectedLead?.id,
      dealId: resolvedDealId,
      titulo,
      cliente: cliente.nome && cliente.celular ? cliente : undefined,
    };
  }, [collectSnapshot, savedPropostaId, savedVersaoId, potenciaKwp, precoFinal, geracaoMensalEstimada, ucs, selectedLead, resolvedDealId, nomeProposta, cliente]);

  /** Apply result from atomic persist to local state */
  const applyPersistResult = useCallback((res: AtomicPersistResult) => {
    if (res.status === "error" || res.status === "blocked") return;
    if (res.propostaId) setSavedPropostaId(res.propostaId);
    if (res.versaoId) setSavedVersaoId(res.versaoId);
    if (res.projetoId) setSavedProjetoId(res.projetoId);
    if (res.dealId) setSavedDealId(res.dealId);
  }, []);

  // ─── Fire-and-forget: persist custom field values to deal_custom_field_values (RB-25)
  const syncCustomFieldValues = useCallback((dealId: string | undefined | null) => {
    if (!dealId || Object.keys(customFieldValues).length === 0) return;
    saveCustomFieldsMutation.mutate(
      { dealId, values: customFieldValues },
      { onError: (err) => console.error("[ProposalWizard] Custom fields save error:", err) },
    );
  }, [customFieldValues, saveCustomFieldsMutation]);

  const handleSaveDraft = useCallback(async () => {
    if (isRestoring) {
      toast({ title: "Aguarde", description: "Carregando dados da proposta..." });
      return;
    }
    if (dealIdFromUrl && !resolvedDealId) {
      toast({ title: "Erro", description: "deal_id obrigatório ao salvar proposta dentro de projeto.", variant: "destructive" });
      return;
    }
    const effectivePropostaId = savedPropostaId || propostaIdFromUrl || null;
    const effectiveVersaoId = savedVersaoId || versaoIdFromUrl || null;
    if (!savedPropostaId && effectivePropostaId) setSavedPropostaId(effectivePropostaId);
    if (!savedVersaoId && effectiveVersaoId) setSavedVersaoId(effectiveVersaoId);

    const params = buildPersistParams(effectivePropostaId, effectiveVersaoId);
    const res = await persistAtomic(params, "draft");

    switch (res.status) {
      case "success":
        applyPersistResult(res);
        syncCustomFieldValues(res.dealId || resolvedDealId);
        toast({ title: "✅ Rascunho salvo" });
        break;
      case "reused":
        applyPersistResult(res);
        break;
      case "blocked":
        toast({ title: "Aguarde", description: res.message, variant: "destructive" });
        break;
      case "error":
        console.error("[ProposalWizard] Draft save error:", res.reason, res.message);
        toast({ title: "Erro ao salvar", description: res.reason || res.message, variant: "destructive" });
        break;
    }
  }, [isRestoring, savedPropostaId, savedVersaoId, propostaIdFromUrl, versaoIdFromUrl, buildPersistParams, persistAtomic, applyPersistResult, dealIdFromUrl, resolvedDealId, syncCustomFieldValues]);

  const handleUpdate = useCallback(async (setActive: boolean) => {
    if (isRestoring) {
      toast({ title: "Aguarde", description: "A proposta ainda está sendo restaurada." });
      return;
    }

    const effectivePropostaId = savedPropostaId || propostaIdFromUrl || null;
    const effectiveVersaoId = savedVersaoId || versaoIdFromUrl || null;

    // Sync state if using URL fallback
    if (!savedPropostaId && effectivePropostaId) setSavedPropostaId(effectivePropostaId);
    if (!savedVersaoId && effectiveVersaoId) setSavedVersaoId(effectiveVersaoId);

    const params = buildPersistParams(effectivePropostaId, effectiveVersaoId);
    const intent = setActive ? "active" as const : "draft" as const;
    const res = await persistAtomic(params, intent);

    switch (res.status) {
      case "success":
      case "reused":
        applyPersistResult(res);
        syncCustomFieldValues(res.dealId || resolvedDealId);
        if (res.newVersionCreated) {
          toast({ title: "Nova versão criada", description: res.message });
        } else if (res.status !== "reused") {
          toast({ title: setActive ? "✅ Proposta ativada!" : "✅ Rascunho salvo!" });
        }
        break;
      case "blocked":
        toast({ title: "Aguarde", description: res.message, variant: "destructive" });
        break;
      case "error":
        console.error("[ProposalWizard] Update error:", res.reason, res.message);
        toast({ title: "Erro ao salvar", description: res.reason || res.message, variant: "destructive" });
        break;
    }
  }, [isRestoring, savedPropostaId, savedVersaoId, propostaIdFromUrl, versaoIdFromUrl, buildPersistParams, persistAtomic, applyPersistResult, syncCustomFieldValues, resolvedDealId]);

  // ─── Grupo consistency validation
  const grupoValidation = useMemo(() => validateGrupoConsistency(ucs), [ucs]);
  const isGrupoMixed = !grupoValidation.valid && grupoValidation.error === "mixed_grupos";
  const isGrupoUndefined = !grupoValidation.valid && grupoValidation.error === "grupo_indefinido";

  // ─── Enforcement: resolver context
  // Derive precisao from UC tariff data already in state
  const precisaoFrontend = useMemo((): 'exato' | 'estimado' => {
    const uc = ucs[0];
    if (!uc) return 'estimado';
    if (uc.tarifa_fio_b && uc.tarifa_fio_b > 0) return 'exato';
    if (uc.tarifa_distribuidora && uc.tarifa_distribuidora > 0) return 'estimado';
    return 'estimado';
  }, [ucs]);

  const resolverContext = useMemo<ProposalResolverContext>(() => ({
    cliente: {
      nome: cliente.nome || selectedLead?.nome,
      empresa: cliente.empresa,
      cnpj_cpf: cliente.cnpj_cpf,
      email: cliente.email,
      celular: cliente.celular,
      cep: cliente.cep,
      endereco: cliente.endereco,
      numero: cliente.numero,
      complemento: cliente.complemento,
      bairro: cliente.bairro,
      cidade: cliente.cidade || locCidade,
      estado: cliente.estado || locEstado,
    },
    ucs,
    premissas,
    potenciaKwp,
    geracaoMensal: geracaoMensalEstimada > 0 ? geracaoMensalEstimada : undefined,
    precoTotal: precoFinal ?? 0,
    consultorNome: undefined, // filled by backend
    tariffVersion: {
      precisao: precisaoFrontend,
      te_kwh: 0,
      tusd_total_kwh: 0,
      fio_b_real_kwh: null,
      origem: 'frontend_uc',
    } satisfies TariffVersionContext,
  }), [cliente, selectedLead, ucs, premissas, potenciaKwp, geracaoMensalEstimada, precoFinal, locCidade, locEstado, precisaoFrontend]);

  const enforcement = useProposalEnforcement(resolverContext);

  // Feed resolved proposal variables to DevTools panel
  const { setActiveProposalVars, enabled: devEnabled } = useDevToolsContext();
  useEffect(() => {
    if (devEnabled && enforcement.resolverResult?.variables) {
      setActiveProposalVars(enforcement.resolverResult.variables);
    }
  }, [devEnabled, enforcement.resolverResult?.variables, setActiveProposalVars]);

  // (geracaoMensalEstimada moved before save callbacks)

  // Estimated area (m²) from module items — ~2m² per module panel
  const areaUtilEstimada = useMemo(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    const totalPaineis = modulosNoKit.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    return totalPaineis > 0 ? Math.round(totalPaineis * 2) : 0;
  }, [itens]);

  // Auto-sync potenciaKwp from kit items (modules) when items change
  useEffect(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    if (modulosNoKit.length === 0) return;
    const potenciaFromKit = modulosNoKit.reduce(
      (s, m) => s + ((m.potencia_w || 0) * (m.quantidade || 1)) / 1000, 0
    );
    if (potenciaFromKit > 0 && Math.abs(potenciaFromKit - potenciaKwp) > 0.01) {
      setPotenciaKwp(potenciaFromKit);
    }
  }, [itens]);

  // ─── Data fetching (extracted hooks)
  useSolarBrainSync(setPremissas, setPreDimensionamento, !!(propostaIdFromUrl && versaoIdFromUrl));
  const tenantTarifas = useTenantTarifas();

  // Apply tenant tariff defaults to UCs that still have zero values
  useEffect(() => {
    if (!tenantTarifas) return;
    setUcs(prev => {
      const needsUpdate = prev.some(u =>
        (u.tarifa_distribuidora === 0 && u.tarifa_te_p === 0 && u.tarifa_te_fp === 0)
        || (!u.tarifa_fio_b || u.tarifa_fio_b === 0)
      );
      if (!needsUpdate) return prev;
      return prev.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas, ucsRestoreEpoch]);

  // Wrapper: auto-apply tenant tariff defaults when UCs change (e.g. new UC added)
  const handleUcsChange = useCallback((newUcs: UCData[] | ((prev: UCData[]) => UCData[])) => {
    setUcs(prev => {
      const resolved = typeof newUcs === "function" ? newUcs(prev) : newUcs;
      if (!tenantTarifas) return resolved;
      return resolved.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas]);

  // ─── Set project context from URL (even without customer_id)
  useEffect(() => {
    if (dealIdFromUrl) {
      setProjectContext({ dealId: dealIdFromUrl, customerId: customerIdFromUrl || "" });
    }
  }, [dealIdFromUrl, customerIdFromUrl]);

  // ─── Auto-load from project context (customer data)
  useEffect(() => {
    if (!customerIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth — skip customer auto-load
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email, cpf_cnpj, empresa, cep, rua, numero, complemento, bairro, cidade, estado, lead_id, municipio_ibge_codigo")
          .eq("id", customerIdFromUrl)
          .single();
        if (cancelled || !cli) return;

        setCliente({
          nome: cli.nome || "", empresa: cli.empresa || "", cnpj_cpf: cli.cpf_cnpj || "",
          email: cli.email || "", celular: cli.telefone || "",
          cep: cli.cep || "", endereco: cli.rua || "", numero: cli.numero || "",
          complemento: cli.complemento || "", bairro: cli.bairro || "",
          cidade: cli.cidade || "", estado: cli.estado || "",
        });

        // Populate project address fields from customer data
        setProjectAddress(prev => ({
          ...prev,
          cep: cli.cep || prev.cep,
          rua: cli.rua || prev.rua,
          numero: cli.numero || prev.numero,
          complemento: cli.complemento || prev.complemento,
          bairro: cli.bairro || prev.bairro,
          cidade: cli.cidade || prev.cidade,
          uf: cli.estado || prev.uf,
        }));

        if (cli.estado) setLocEstado(cli.estado);
        if (cli.cidade) setLocCidade(cli.cidade);
        if (cli.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(cli.municipio_ibge_codigo);

        if (cli.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado, municipio_ibge_codigo")
            .eq("id", cli.lead_id)
            .single();
          if (!cancelled && lead) {
            const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
              municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
            });
            if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
            if (mappedTelhado) setLocTipoTelhado(mappedTelhado);
            if (lead.estado || lead.media_consumo) {
              setUcs(prev => {
                const updated = [...prev];
                updated[0] = {
                  ...updated[0],
                  estado: lead.estado || updated[0].estado,
                  cidade: lead.cidade || updated[0].cidade,
                  tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
                  consumo_mensal: lead.media_consumo || updated[0].consumo_mensal,
                };
                return updated;
              });
            }
          }
        }

        // ─── Fallback: if client has no lead, try to recover data from most recent proposal snapshot
        if (!cli.lead_id) {
          // Find the most recent proposta for this client
          const { data: lastProposta } = await supabase
            .from("propostas_nativas")
            .select("id")
            .eq("cliente_id", customerIdFromUrl)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastProposta?.id) {
            const { data: lastVersao } = await supabase
              .from("proposta_versoes" as any)
              .select("snapshot, potencia_kwp, valor_total")
              .eq("proposta_id", lastProposta.id)
              .order("versao_numero", { ascending: false })
              .limit(1)
              .maybeSingle();

            const snap = (lastVersao as any)?.snapshot as Record<string, any> | null;
            if (!cancelled && snap) {
              // Pre-fill tipo de telhado from snapshot
              const roofType = snap.roof_type || snap.locTipoTelhado;
              if (roofType) {
                const mapped = mapLeadTipoTelhadoToProposal(roofType) || roofType;
                setLocTipoTelhado(mapped);
              }

              // Pre-fill distribuidora — resolve ID by name with fuzzy matching
              const disNome = snap.dis_energia || snap.locDistribuidoraNome;
              const disId = snap.locDistribuidoraId;
              if (disId) {
                setLocDistribuidoraId(disId);
                if (disNome) setLocDistribuidoraNome(disNome);
              } else if (disNome) {
                setLocDistribuidoraNome(disNome);
                // Split words for fuzzy matching (e.g. "Energisa MG" → search each word)
                const words = disNome.split(/\s+/).filter((w: string) => w.length >= 2);
                let resolved = false;
                // Try exact ilike first
                const { data: conc } = await supabase
                  .from("concessionarias")
                  .select("id, nome")
                  .ilike("nome", `%${disNome}%`)
                  .limit(1)
                  .maybeSingle();
                if (conc?.id) {
                  setLocDistribuidoraId(conc.id);
                  setLocDistribuidoraNome(conc.nome);
                  resolved = true;
                }
                // Fallback: try matching by state abbreviation (e.g. "MG" → "Minas Gerais")
                if (!resolved && cli.estado) {
                  const { data: concByState } = await supabase
                    .from("concessionarias")
                    .select("id, nome")
                    .eq("estado", cli.estado)
                    .ilike("nome", `%${words[0]}%`)
                    .limit(1)
                    .maybeSingle();
                  if (concByState?.id) {
                    setLocDistribuidoraId(concByState.id);
                    setLocDistribuidoraNome(concByState.nome);
                    resolved = true;
                  }
                }
                // Last resort: search by first word only
                if (!resolved && words.length > 0) {
                  const { data: concWord } = await supabase
                    .from("concessionarias")
                    .select("id, nome")
                    .ilike("nome", `%${words[0]}%`)
                    .limit(1)
                    .maybeSingle();
                  if (concWord?.id) {
                    setLocDistribuidoraId(concWord.id);
                    setLocDistribuidoraNome(concWord.nome);
                  }
                }
              }

              // Pre-fill consumo from snapshot
              const consumo = snap.consumo_mensal || snap.ucs?.[0]?.consumo_kwh;
              if (consumo && consumo > 0) {
                setUcs(prev => {
                  const updated = [...prev];
                  if (updated[0].consumo_mensal === 0) {
                    updated[0] = { ...updated[0], consumo_mensal: consumo };
                  }
                  return updated;
                });
              }

              // Pre-fill kit items from snapshot
              if (snap.panel_model || snap.inverter_model) {
                const recoveredItens: KitItemRow[] = [];
                if (snap.panel_model) {
                  recoveredItens.push({
                    id: crypto.randomUUID(),
                    descricao: snap.panel_model,
                    fabricante: "",
                    modelo: snap.panel_model,
                    potencia_w: 0,
                    quantidade: snap.panel_quantity || 1,
                    preco_unitario: 0,
                    categoria: "modulo",
                    avulso: false,
                  });
                }
                if (snap.inverter_model) {
                  recoveredItens.push({
                    id: crypto.randomUUID(),
                    descricao: snap.inverter_model,
                    fabricante: "",
                    modelo: snap.inverter_model,
                    potencia_w: 0,
                    quantidade: snap.inverter_quantity || 1,
                    preco_unitario: 0,
                    categoria: "inversor",
                    avulso: false,
                  });
                }
                if (recoveredItens.length > 0) setItens(recoveredItens);
              }

              // Pre-fill venda from snapshot
              if (snap.equipment_cost || snap.installation_cost) {
                setVenda(prev => ({
                  ...prev,
                  custo_kit: snap.equipment_cost || prev.custo_kit,
                  custo_instalacao: snap.installation_cost || prev.custo_instalacao,
                }));
              }

              // console.log("[ProposalWizard] Recovered from snapshot:", { roofType, disNome, disId, consumo, panel: snap.panel_model, inverter: snap.inverter_model });
            }
          }
        }

        toast({ title: "Dados carregados do projeto", description: `Cliente: ${cli.nome}` });
      } catch (err) {
        console.error("[ProposalWizard] Error loading project context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [customerIdFromUrl, dealIdFromUrl]);

  // ─── Auto-load from lead_id URL param (from PropostasTab selection)
  // When orc_id is also present, skip location pre-fill (ORC takes priority)
  useEffect(() => {
    if (!leadIdFromUrl || selectedLead?.id === leadIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    // If ORC is present, only load lead for context (name/phone) — ORC handles location
    const orcTakesPriority = !!orcIdFromUrl;
    let cancelled = false;
    (async () => {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, bairro, cep, rua, numero, complemento, valor_estimado, observacoes, area, municipio_ibge_codigo")
          .eq("id", leadIdFromUrl)
          .single();
        if (cancelled || !lead) return;

        setSelectedLead({
          id: lead.id, nome: lead.nome, telefone: lead.telefone,
          lead_code: lead.lead_code || "", estado: lead.estado,
          cidade: lead.cidade, media_consumo: lead.media_consumo,
          geracao_estimada_kwh: lead.consumo_previsto || undefined,
          tipo_telhado: lead.tipo_telhado,
          rede_atendimento: lead.rede_atendimento,
          bairro: lead.bairro || undefined,
          cep: lead.cep || undefined,
          endereco: lead.rua || undefined,
          municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
        });
        if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);

        // When ORC is present, skip location pre-fill — ORC data has priority
        if (!orcTakesPriority) {
          if (lead.estado) setLocEstado(lead.estado);
          if (lead.cidade) setLocCidade(lead.cidade);
          const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
          if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

          // consumo_previsto = geração estimada pelo vendedor, NÃO é consumo
          const consumo = lead.media_consumo || 0;
          const faseData = redeAtendimentoToFaseTensao(lead.rede_atendimento);

          setUcs(prev => {
            const updated = [...prev];
            updated[0] = {
              ...updated[0],
              estado: lead.estado || updated[0].estado,
              cidade: lead.cidade || updated[0].cidade,
              tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
              consumo_mensal: consumo || updated[0].consumo_mensal,
              ...(faseData ? {
                fase: faseData.fase,
                fase_tensao: faseData.fase_tensao,
                tensao_rede: faseData.tensao_rede,
              } : {}),
            };
            return updated;
          });

          toast({ title: "Dados do orçamento carregados", description: `Lead: ${lead.nome} — ${consumo} kWh` });
        }
      } catch (err) {
        console.error("[ProposalWizard] Error loading lead context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [leadIdFromUrl, orcIdFromUrl]);

  // ─── Auto-load from orc_id URL param (direct ORC click from PropostasTab)
  useEffect(() => {
    if (!orcIdFromUrl) return;
    // In edit mode (restoring from DB), snapshot is the source of truth
    if (propostaIdFromUrl && versaoIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: orc } = await supabase
          .from("orcamentos")
          .select("id, orc_code, lead_id, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, estado, cidade, area, observacoes")
          .eq("id", orcIdFromUrl)
          .single();
        if (cancelled || !orc) return;

        // Pre-fill location from ORC (with tipo_telhado mapping)
        if (orc.estado) setLocEstado(orc.estado);
        if (orc.cidade) setLocCidade(orc.cidade);
        const mappedTelhado = mapLeadTipoTelhadoToProposal(orc.tipo_telhado);
        if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

        // Pre-fill UC data from ORC
        // consumo_previsto = geração estimada, não consumo médio
        const consumo = orc.media_consumo || orc.consumo_previsto || 0;
        const faseData = redeAtendimentoToFaseTensao(orc.rede_atendimento);

        setUcs(prev => {
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            estado: orc.estado || updated[0].estado,
            cidade: orc.cidade || updated[0].cidade,
            tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
            consumo_mensal: consumo || updated[0].consumo_mensal,
            ...(faseData ? {
              fase: faseData.fase,
              fase_tensao: faseData.fase_tensao,
              tensao_rede: faseData.tensao_rede,
            } : {}),
          };
          return updated;
        });

        // Also load the lead linked to this ORC for full context
        if (orc.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado, municipio_ibge_codigo")
            .eq("id", orc.lead_id)
            .single();
          if (!cancelled && lead) {
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
              municipio_ibge_codigo: lead.municipio_ibge_codigo || undefined,
            });
            if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
          }
        }

        toast({
          title: "Dados do orçamento carregados",
          description: `${orc.orc_code || "ORC"} — ${consumo} kWh • ${orc.tipo_telhado || ""} • ${orc.rede_atendimento || ""}`,
        });
      } catch (err) {
        console.error("[ProposalWizard] Error loading ORC context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [orcIdFromUrl]);

  const handleSelectLead = (lead: LeadSelection) => {
    setSelectedLead(lead);
    if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
    if (lead.estado) setLocEstado(lead.estado);
    if (lead.cidade) setLocCidade(lead.cidade);
    const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
    if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

    const faseData = redeAtendimentoToFaseTensao(lead.rede_atendimento);
    const consumo = lead.media_consumo || 0;

    setUcs(prev => {
      const updated = [...prev];
      updated[0] = {
        ...updated[0],
        estado: lead.estado || updated[0].estado,
        cidade: lead.cidade || updated[0].cidade,
        tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
        ...(consumo ? { consumo_mensal: consumo } : {}),
        ...(faseData ? {
          fase: faseData.fase,
          fase_tensao: faseData.fase_tensao,
          tensao_rede: faseData.tensao_rede,
        } : {}),
      };
      return updated;
    });
  };

  // ─── Validations per step key
  const canAdvance: Record<string, boolean> = {
    [STEP_KEYS.LOCALIZACAO]: !!locEstado && !!locCidade && !!locTipoTelhado && !!locDistribuidoraId,
    [STEP_KEYS.UCS]: consumoTotal > 0 && grupoValidation.valid,
    [STEP_KEYS.CAMPOS_PRE]: true,
    [STEP_KEYS.KIT]: itens.some(i => i.categoria === "modulo" && i.quantidade >= 1 && i.potencia_w > 0)
      && potenciaKwp > 0
      && ((venda.custo_kit_override ?? itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)) > 0),
    [STEP_KEYS.ADICIONAIS]: true,
    [STEP_KEYS.SERVICOS]: true,
    [STEP_KEYS.VENDA]: true,
    [STEP_KEYS.PAGAMENTO]: true,
    [STEP_KEYS.RESUMO]: true,
    [STEP_KEYS.PROPOSTA]: grupoValidation.valid,
  };

  const canCurrentStep = canAdvance[currentStepKey] ?? true;

  const resumoFinancialWarnings = useMemo(() => {
    const warnings: string[] = [];
    const custoBase = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
    const custoTotal = custoBase + venda.custo_instalacao + venda.custo_comissao + venda.custo_outros;

    if (precoFinal > 0 && custoTotal > 0 && precoFinal < custoTotal) {
      warnings.push(
        `Margem real negativa: o preço de venda (${formatBRL(precoFinal)}) está abaixo do custo total (${formatBRL(custoTotal)}).`
      );
    } else if (venda.margem_percentual <= 0) {
      warnings.push("Margem de lucro zerada ou negativa. O preço final pode não cobrir custos.");
    }

    return warnings;
  }, [itens, venda.custo_instalacao, venda.custo_comissao, venda.custo_outros, venda.margem_percentual, precoFinal]);

  // ─── Pre-generation: validate template before generating
  const handlePreGenerate = () => {
    if (!templateSelecionado) {
      toast({ title: "Template obrigatório", description: "Selecione um template de proposta antes de gerar.", variant: "destructive" });
      return;
    }
    handleGenerate();
  };

  // ─── Gate modal confirmed (warnings accepted) → proceed to pos-dimensionamento
  const handleGateConfirmed = () => {
    if (!nomeProposta && (cliente.nome || selectedLead?.nome)) {
      setNomeProposta(cliente.nome || selectedLead?.nome || "");
    }
    setShowPosDialog(true);
  };

  // ─── Generate (with enforcement gate)
  const handleGenerate = async () => {
    // Allow generation without a lead if client data is filled manually
    let effectiveLead = selectedLead;
    if (!effectiveLead) {
      if (cliente.nome && cliente.celular) {
        // Synthesize a lead-like object from manually entered client data
        effectiveLead = {
          id: crypto.randomUUID(),
          nome: cliente.nome,
          telefone: cliente.celular,
          lead_code: "",
          estado: cliente.estado || locEstado,
          cidade: cliente.cidade || locCidade,
          media_consumo: consumoTotal,
          tipo_telhado: locTipoTelhado,
          _synthetic: true,
        } as any;
        setSelectedLead(effectiveLead);
      } else {
        toast({ title: "Dados insuficientes", description: "Preencha pelo menos o nome e celular do cliente, ou selecione um lead.", variant: "destructive" });
        return;
      }
    }

    // ── Grupo consistency gate
    if (!grupoValidation.valid) {
      toast({
        title: "Erro de grupo tarifário",
        description: grupoValidation.error === "mixed_grupos"
          ? "Não é permitido misturar UCs de Grupo A e Grupo B na mesma proposta."
          : "Há UCs sem grupo tarifário definido. Defina o subgrupo de todas as UCs.",
        variant: "destructive",
      });
      return;
    }

    // ── Enforcement gate: block if missing variables or estimativa not accepted
    // console.debug("[ProposalWizard] Enforcement check:", {
    //   precoFinal, resolverPrecoTotal: resolverContext.precoTotal,
    //   potenciaKwp, resolverResult: enforcement.resolverResult,
    // });
    const gate = enforcement.checkGate();
    if (!gate.allowed) {
      console.warn("[ProposalWizard] PDF blocked:", gate);
      setBlockReason(gate.reason!);
      setBlockMissing(gate.missingVariables || []);
      setShowBlockModal(true);
      enforcement.logBlock(null, gate.reason!, gate.missingVariables || []);
      return;
    }

    setGenerating(true);
    setGenerationStatus("calculating");
    setGenerationError(null);
    setHtmlPreview(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setDocxBlob(null);
    setOutputDocxPath(null);
    setOutputPdfPath(null);
    setResult(null);

    try {
      // Ensure draft is saved (creates project if needed) before generating
      let projetoId = savedProjetoId;
      if (!projetoId) {
        const params = buildPersistParams(
          savedPropostaId || propostaIdFromUrl || null,
          savedVersaoId || versaoIdFromUrl || null,
        );
        let draftRes = await persistAtomic(params, "draft");

        // If blocked by concurrent save, wait and retry once
        if (draftRes.status === "blocked") {
          // console.log("[ProposalWizard] Draft blocked, retrying in 2s...");
          await new Promise(r => setTimeout(r, 2000));
          draftRes = await persistAtomic(params, "draft");
        }

        if (draftRes.status === "success" || draftRes.status === "reused") {
          if (draftRes.propostaId) setSavedPropostaId(draftRes.propostaId);
          if (draftRes.versaoId) setSavedVersaoId(draftRes.versaoId);
          if (draftRes.projetoId) {
            projetoId = draftRes.projetoId;
            setSavedProjetoId(draftRes.projetoId);
          }
          if (draftRes.dealId) setSavedDealId(draftRes.dealId);
        }
        if (!projetoId) {
          const errorDetail = draftRes.status === "error"
            ? (draftRes.reason || draftRes.message || "Erro desconhecido ao salvar rascunho")
            : draftRes.status === "blocked"
              ? "Outra operação de salvamento está em andamento. Tente novamente em alguns segundos."
              : "Não foi possível criar o projeto associado. Tente salvar o rascunho antes.";
          console.error("[ProposalWizard] Draft save failed:", draftRes);
          toast({ title: "Erro ao criar proposta", description: errorDetail, variant: "destructive" });
          setGenerating(false);
          return;
        }
      }

      const isSyntheticLead = !!(effectiveLead as any)?._synthetic;
      const realLeadId = isSyntheticLead ? undefined : effectiveLead!.id;
      const clienteIdForPayload = isSyntheticLead ? (effectiveLead as any)._clienteId : undefined;
      const idempotencyKey = generateIdempotencyKey(realLeadId || clienteIdForPayload || "no-lead");
      const payload: GenerateProposalPayload = {
        lead_id: realLeadId || undefined,
        cliente_id: clienteIdForPayload,
        projeto_id: projetoId,
        grupo: grupoValidation.grupo || (grupo.startsWith("B") ? "B" : "A"),
        idempotency_key: idempotencyKey,
        template_id: templateSelecionado || undefined,
        potencia_kwp: potenciaKwp,
        ucs: ucs.map(uc => ({
          nome: uc.nome,
          tipo_dimensionamento: uc.tipo_dimensionamento,
          distribuidora: uc.distribuidora,
          distribuidora_id: uc.distribuidora_id,
          subgrupo: uc.subgrupo,
          estado: uc.estado,
          cidade: uc.cidade,
          fase: uc.fase,
          tensao_rede: uc.tensao_rede,
          consumo_mensal: uc.consumo_mensal,
          consumo_meses: uc.consumo_meses,
          consumo_mensal_p: uc.consumo_mensal_p,
          consumo_mensal_fp: uc.consumo_mensal_fp,
          tarifa_distribuidora: uc.tarifa_distribuidora,
          tarifa_te_p: uc.tarifa_te_p,
          tarifa_tusd_p: uc.tarifa_tusd_p,
          tarifa_te_fp: uc.tarifa_te_fp,
          tarifa_tusd_fp: uc.tarifa_tusd_fp,
          demanda_preco: uc.demanda_preco ?? uc.demanda_consumo_kw ?? 0,
          demanda_contratada: uc.demanda_contratada ?? uc.demanda_geracao_kw ?? 0,
          demanda_adicional: uc.demanda_adicional ?? 0,
          custo_disponibilidade_kwh: uc.custo_disponibilidade_kwh,
          custo_disponibilidade_valor: uc.custo_disponibilidade_valor,
          outros_encargos_atual: uc.outros_encargos_atual,
          outros_encargos_novo: uc.outros_encargos_novo,
          distancia: uc.distancia,
          tipo_telhado: uc.tipo_telhado,
          inclinacao: uc.inclinacao,
          desvio_azimutal: uc.desvio_azimutal,
          taxa_desempenho: uc.taxa_desempenho,
          regra_compensacao: uc.regra_compensacao,
          rateio_sugerido_creditos: uc.rateio_sugerido_creditos,
          rateio_creditos: uc.rateio_creditos,
          imposto_energia: uc.imposto_energia,
          fator_simultaneidade: uc.fator_simultaneidade,
        })),
        premissas,
        itens: itens.filter(i => i.descricao).map(({ id, ...rest }) => rest),
        servicos: servicos.map(({ id, ...rest }) => rest),
        venda: {
          custo_comissao: venda.custo_comissao,
          custo_outros: venda.custo_outros,
          margem_percentual: venda.margem_percentual,
          desconto_percentual: venda.desconto_percentual,
          observacoes: venda.observacoes,
        },
        pagamento_opcoes: pagamentoOpcoes.map(({ id, ...rest }) => rest),
        observacoes: venda.observacoes || undefined,
        customFieldValues: customFieldValues ?? {},
        aceite_estimativa: enforcement.aceiteEstimativa || undefined,
        // Wizard-specific state for edit round-trip (engine passes through, not used for calc)
        _wizard_state: {
          selectedLead,
          cliente,
          projectAddress,
          preDimensionamento,
          layouts,
          manualKits,
          adicionais,
          customFieldValues,
          nomeProposta,
          descricaoProposta,
          templateSelecionado,
          locSkipPoa,
          locLatitude,
          locGhiSeries,
          locDistribuidoraId,
          geracaoMensalEstimada,
        },
      };

      const genResult = await generateProposal(payload);
      setResult(genResult);
      clearLocal(); // Proposta gerada — limpar rascunho local

      // Audit is now persisted by the backend — no need for frontend persistAudit

      // Determine if selected template is DOCX or HTML
      const selectedTpl = proposalTemplates.find(t => t.id === templateSelecionado);
      const isDocxTemplate = selectedTpl?.tipo === "docx";

      setRendering(true);
      setGenerationStatus("generating_docx");

      try {
        if (isDocxTemplate && genResult.proposta_id) {
          // DOCX template: call template-preview with JSON response to get persisted paths
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "bguhckqkpnziykpbwbeu";
          const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWhja3FrcG56aXlrcGJ3YmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NzgwNzQsImV4cCI6MjA4NjA1NDA3NH0.BQAdNsi05xoWHhYJnnvmW3MIwnm8gbXTqosCTe5Ykxw";
          const { data: { session } } = await supabase.auth.getSession();
          const rawResp = await fetch(`https://${projectId}.supabase.co/functions/v1/template-preview`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${session?.access_token || anonKey}`,
              "apikey": anonKey,
              "x-client-timeout": "120",
            },
            body: JSON.stringify({
              template_id: templateSelecionado,
              proposta_id: genResult.proposta_id,
              response_format: "json",
            }),
          });
          setGenerationStatus("converting_pdf");
          if (!rawResp.ok) {
            const errBody = await rawResp.text();
            let parsedBody: any = null;
            try { parsedBody = JSON.parse(errBody); } catch { /* ignore */ }

            // Handle backend audit blocking (422)
            if (rawResp.status === 422 && parsedBody?.blocked_by_audit) {
              console.error("[ProposalWizard] Generation blocked by backend audit:", parsedBody.critical_variables);

              // Use audit from backend if available
              if (parsedBody.audit) {
                setGenerationAuditReport(parsedBody.audit as GenerationAuditReport);
              }
              setMissingVars(parsedBody.missing_vars ?? []);
              setGenerationStatus("error");
              setGenerationError(
                `Variáveis críticas não resolvidas: ${(parsedBody.critical_variables || []).join(", ")}. Corrija os dados antes de gerar.`
              );
              toast({
                title: "Geração bloqueada",
                description: `${(parsedBody.critical_variables || []).length} variável(is) crítica(s) com erro. PDF não foi gerado.`,
                variant: "destructive",
              });
              setRendering(false);
              setGenerating(false);
              return;
            }

            let errorMsg = "Erro ao gerar DOCX";
            try { errorMsg = parsedBody?.error || errorMsg; } catch { errorMsg = errBody || errorMsg; }
            throw new Error(errorMsg);
          }

          const artifactResult = await rawResp.json();
          // console.log("[ProposalWizard] Artifact result:", artifactResult);

          // Handle missing_vars from backend — store for UI display
          const backendMissing: string[] = artifactResult.missing_vars ?? [];
          const backendEmpty: string[] = artifactResult.empty_vars ?? [];
          const resolvedCount: number = artifactResult.resolved_vars_count ?? 0;
          setMissingVars(backendMissing);

          // Use audit report from backend (already persisted server-side)
          if (artifactResult.audit) {
            setGenerationAuditReport(artifactResult.audit as GenerationAuditReport);
            // console.log("[ProposalWizard] Using backend audit:", {
            //   health: artifactResult.audit.health,
            //   score: artifactResult.audit.healthScore,
            //   errors: artifactResult.audit.errorCount,
            //   warnings: artifactResult.audit.warningCount,
            // });
          } else {
            // Fallback: build audit locally if backend didn't provide it
            const customVarResults = artifactResult.custom_var_results ?? artifactResult.variaveis_custom ?? [];
            const auditReport = buildGenerationAuditReport({
              templateId: templateSelecionado,
              templateName: artifactResult.template_name || "",
              propostaId: genResult.proposta_id || "",
              versaoId: genResult.versao_id || undefined,
              totalVarsProvided: resolvedCount + backendMissing.length,
              missingVars: backendMissing,
              emptyVars: backendEmpty,
              resolvedCount,
              customVarResults: customVarResults.length > 0 ? customVarResults.map((cv: any) => ({
                nome: cv.nome,
                expressao: cv.expressao,
                valor_calculado: cv.valor_calculado,
                error: cv.error ?? false,
                error_message: cv.error_message,
              })) : undefined,
            });
            setGenerationAuditReport(auditReport);
          }

          // Store persisted paths
          setOutputDocxPath(artifactResult.output_docx_path || null);
          setOutputPdfPath(artifactResult.output_pdf_path || null);

          // Handle generation status from backend
          if (artifactResult.generation_status === "error" || (!artifactResult.output_pdf_path && !artifactResult.output_docx_path)) {
            setGenerationStatus("error");
            // Translate raw URL errors to friendly messages
            const rawError = artifactResult.generation_error || "Falha na geração do documento";
            const friendlyError = rawError.includes("Invalid URL") || rawError.includes("Configuração inválida")
              ? "Falha na configuração do serviço de conversão PDF. Verifique a variável GOTENBERG_URL nas configurações do projeto."
              : rawError;
            setGenerationError(friendlyError);
            toast({
              title: "Erro na geração",
              description: friendlyError,
              variant: "destructive",
            });
          } else if (artifactResult.output_pdf_path) {
            // Generate signed URL for PDF preview from persisted storage
            setGenerationStatus("saving");
            const { data: signedData } = await supabase.storage
              .from("proposta-documentos")
              .createSignedUrl(artifactResult.output_pdf_path, 3600);
            if (signedData?.signedUrl) {
              setPdfBlobUrl(signedData.signedUrl);
              setGenerationStatus("ready");
              toast({
                title: "Proposta gerada!",
                description: "PDF salvo e preview exibido. Use os botões para baixar ou enviar.",
              });
            } else {
              setGenerationStatus("error");
              setGenerationError("Não foi possível gerar URL de preview do PDF");
            }
          } else {
            // DOCX only (PDF conversion failed) - show as partial success, not full error
            setGenerationStatus("docx_only");
            const rawPdfError = artifactResult.generation_error || "";
            const friendlyPdfError = rawPdfError.includes("Invalid URL") || rawPdfError.includes("Configuração inválida")
              ? "Falha na configuração do serviço de conversão PDF. O DOCX foi salvo e está disponível para download."
              : `Conversão PDF falhou. O DOCX foi salvo e está disponível para download.`;
            setGenerationError(friendlyPdfError);
            console.warn("[ProposalWizard] PDF conversion failed, DOCX available:", rawPdfError);
            toast({
              title: "DOCX gerado com sucesso",
              description: friendlyPdfError,
              variant: "default",
            });
          }
        } else {
          // HTML template: use proposal-render as before
          const renderResult = await renderProposal(genResult.versao_id);
          setHtmlPreview(renderResult.html);
          setGenerationStatus("ready");
        }
      } catch (e: any) {
        setGenerationStatus("error");
        setGenerationError(e.message || "Erro ao renderizar documento");
        toast({ title: "Erro ao renderizar", description: e.message, variant: "destructive" });
      } finally { setRendering(false); }

      // Save pricing history for smart defaults in future proposals
      const instalacaoVal = servicos.find(s => s.categoria === "instalacao")?.valor || 0;
      savePricingHistory({
        potenciaKwp,
        margemPercentual: venda.margem_percentual,
        custoComissao: venda.custo_comissao,
        custoOutros: venda.custo_outros,
        custoInstalacao: instalacaoVal,
        propostaId: genResult.proposta_id,
      }).catch(e => console.error("Error saving pricing history:", e));
    } catch (e: any) {
      // ── Handle structured 422 errors from backend enforcement ──
      const errorCode = (e as any).errorCode;
      if (errorCode === "missing_required_variables") {
        setBlockReason("missing_required");
        setBlockMissing((e as any).missing || []);
        setShowBlockModal(true);
        setGenerationStatus("idle");
        setGenerating(false);
        return;
      }
      if (errorCode === "estimativa_not_accepted") {
        setBlockReason("estimativa_not_accepted");
        setBlockMissing([]);
        setShowBlockModal(true);
        setGenerationStatus("idle");
        setGenerating(false);
        return;
      }
      if (errorCode === "mixed_grupos" || errorCode === "grupo_indefinido") {
        toast({
          title: "Erro de grupo tarifário",
          description: e.message || "Não é permitido misturar Grupo A e Grupo B na mesma proposta.",
          variant: "destructive",
        });
        setGenerationStatus("idle");
        setGenerating(false);
        return;
      }
      setGenerationStatus("error");
      setGenerationError(e.message || "Erro desconhecido ao gerar proposta");
      toast({ title: "Erro ao gerar proposta", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  // ─── Invalidate artifacts when template changes
  const handleTemplateChange = useCallback((newTemplateId: string) => {
    setTemplateSelecionado(newTemplateId);
    // Clear ALL stale artifacts when template changes
    if (result) {
      setResult(null);
      setHtmlPreview(null);
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
      setDocxBlob(null);
      setOutputDocxPath(null);
      setOutputPdfPath(null);
      setGenerationStatus("idle");
      setGenerationError(null);
      setMissingVars([]);
      setGenerationAuditReport(null);
    }
  }, [result, pdfBlobUrl]);

  const handleNewVersion = () => {
    // idempotency key is now generated fresh each time — no need to clear
    setResult(null);
    setHtmlPreview(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setDocxBlob(null);
    setOutputDocxPath(null);
    setOutputPdfPath(null);
    setGenerationStatus("idle");
    setGenerationError(null);
    setMissingVars([]);
    // Go back to UCs step
    const ucsIndex = activeSteps.findIndex(s => s.key === STEP_KEYS.UCS);
    setStep(ucsIndex >= 0 ? ucsIndex : 1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const goToStep = (target: number) => {
    // Only allow navigating to completed (past) steps — never forward
    if (target < step) {
      setStep(target);
    }
  };

  const goNext = () => {
    if (step >= activeSteps.length - 1) return;

    // Intercept: validate Kit step — block if kit cost is zero
    if (currentStepKey === STEP_KEYS.KIT && itens.length > 0) {
      const custoKit = (venda.custo_kit_override != null && venda.custo_kit_override > 0)
        ? venda.custo_kit_override
        : itens.reduce((s, i) => s + (i.quantidade ?? 0) * (i.preco_unitario ?? 0), 0);
      if (custoKit <= 0) {
        toast({
          title: "Kit com custo zerado",
          description: "O kit selecionado possui custo R$ 0,00. Edite o kit ou selecione outro antes de prosseguir.",
          variant: "destructive",
        });
        return;
      }
    }

    // Intercept: when advancing FROM Resumo → run validation gate THEN pos-dimensionamento
    const nextKey = activeSteps[step + 1]?.key;
    if (currentStepKey === STEP_KEYS.RESUMO && nextKey === STEP_KEYS.PROPOSTA) {
      // Run canonical validation before allowing navigation
      const validation = validatePropostaFinal({
        cliente,
        selectedLead,
        ucs,
        itens,
        servicos,
        venda,
        pagamentoOpcoes,
        potenciaKwp,
        precoFinal,
        geracaoMensalKwh: geracaoMensalEstimada,
        consumoTotal,
        economiaMensal: geracaoMensalEstimada > 0
          ? Math.round(geracaoMensalEstimada * (ucs.find(u => u.is_geradora)?.tarifa_distribuidora || 0.80))
          : 0,
        locEstado,
        locCidade,
        locDistribuidoraNome: locDistribuidoraNome,
        templateSelecionado,
        skipTemplateCheck: true, // Template is selected in the Proposta step — don't block here
      });

      // console.debug("[ProposalWizard] Resumo→Proposta validation:", validation);

      // If there are errors or warnings → show gate modal (blocks navigation)
      if (!validation.canGenerate || validation.needsConfirmation) {
        setGateValidation(validation);
        setShowGateModal(true);
        return;
      }

      // Validation clean → show pos-dimensionamento dialog
      if (!nomeProposta && (cliente.nome || selectedLead?.nome)) {
        setNomeProposta(cliente.nome || selectedLead?.nome || "");
      }
      setShowPosDialog(true);
      return;
    }
    setStep(step + 1);
  };

  const handlePosDialogConfirm = () => {
    setShowPosDialog(false);
    setStep(step + 1);
  };

  const goPrev = () => {
    setStep(Math.max(0, step - 1));
  };

  const isLastStep = currentStepKey === STEP_KEYS.PROPOSTA;

  // ─── Render step content by key
  const stepMeta = STEP_META[currentStepKey] || { title: "", description: "" };
  const currentStepDef = activeSteps[step];

  const renderStepContent = () => {
    // console.log("[ProposalWizard] renderStepContent, currentStepKey:", currentStepKey);

    const wrap = (key: string, children: React.ReactNode, headerRight?: React.ReactNode) => (
      <StepContent key={key}>
        <WizardStepCard
          title={stepMeta.title}
          description={stepMeta.description}
          icon={currentStepDef?.icon}
          headerRight={headerRight ?? (
            <span className="text-xs font-mono text-primary font-bold">
              Etapa {step + 1}/{activeSteps.length}
            </span>
          )}
        >
          {children}
        </WizardStepCard>
      </StepContent>
    );

    // Client + Lead cards for header
    const clientHeaderCard = (cliente.nome || selectedLead) ? (
      <div className="flex items-center gap-2 text-xs">
        {/* Cliente card — always left */}
        {cliente.nome && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/30">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary font-semibold">Cliente</Badge>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary shrink-0" />
              {cliente.nome}
            </span>
            {cliente.celular && (
              <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                <Phone className="h-3 w-3 shrink-0" /> {cliente.celular}
              </span>
            )}
          </div>
        )}
        {/* Lead card — always right */}
        {selectedLead && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-secondary/30 bg-secondary/5">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-secondary/40 text-secondary font-semibold">Lead</Badge>
            <span className="font-semibold text-foreground">{selectedLead.nome}</span>
            {selectedLead.telefone && (
              <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                <Phone className="h-3 w-3 shrink-0" /> {selectedLead.telefone}
              </span>
            )}
          </div>
        )}
      </div>
    ) : null;

    switch (currentStepKey) {
      case STEP_KEYS.LOCALIZACAO:
        return wrap("localizacao", (
          <div className="space-y-4">
            <StepLocalizacao
              estado={locEstado} cidade={locCidade} tipoTelhado={locTipoTelhado}
              distribuidoraId={locDistribuidoraId}
              onEstadoChange={setLocEstado}
              onCidadeChange={setLocCidade}
              onTipoTelhadoChange={(v) => {
                setLocTipoTelhado(v);
                // Propagar tipo de telhado para a UC geradora (ucs[0])
                setUcs(prev => {
                  if (prev.length === 0) return prev;
                  if (prev[0].tipo_telhado === v) return prev;
                  return [{ ...prev[0], tipo_telhado: v }, ...prev.slice(1)];
                });
              }}
              onDistribuidoraChange={(id, nome) => { setLocDistribuidoraId(id); setLocDistribuidoraNome(nome); }}
              onIrradiacaoChange={setLocIrradiacao}
              onGhiSeriesChange={setLocGhiSeries}
              onLatitudeChange={setLocLatitude}
              onMapSnapshotsChange={setMapSnapshots}
              skipPoa={locSkipPoa}
              onSkipPoaChange={setLocSkipPoa}
              clienteData={cliente}
              projectAddress={projectAddress}
              onProjectAddressChange={setProjectAddress}
              distanciaKm={distanciaKm}
              onDistanciaKmChange={setDistanciaKm}
            />
            {/* Cliente section — only show full form when NOT from project */}
            {!projectContext && (
              <div className="border-t border-border/50 pt-4">
                <StepCliente
                  selectedLead={selectedLead}
                  onSelectLead={handleSelectLead}
                  onClearLead={() => setSelectedLead(null)}
                  cliente={cliente}
                  onClienteChange={setCliente}
                  fromProject={false}
                />
              </div>
            )}
          </div>
        ), clientHeaderCard);

      case STEP_KEYS.UCS:
        return wrap("ucs", (
          <>
            {/* Grupo consistency alert */}
            {(isGrupoMixed || isGrupoUndefined) && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {isGrupoMixed
                      ? "Mistura de Grupo A e Grupo B detectada"
                      : "Grupo tarifário indefinido"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isGrupoMixed
                      ? "Não é permitido misturar Unidades Consumidoras de Grupo A e Grupo B na mesma proposta. As estruturas tarifárias são diferentes."
                      : "Uma ou mais UCs não possuem subgrupo tarifário definido. Defina o subgrupo para continuar."}
                  </p>
                  {grupoValidation.divergentIndices && grupoValidation.divergentIndices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {grupoValidation.divergentIndices.map(idx => (
                        <Badge key={idx} variant="destructive" className="text-[10px]">
                          UC {idx + 1} — {grupoValidation.grupos[idx] ?? "indefinido"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <StepConsumptionIntelligence
              ucs={ucs} onUcsChange={handleUcsChange}
              potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp}
              preDimensionamento={preDimensionamento}
              onPreDimensionamentoChange={setPreDimensionamento}
              irradiacao={locIrradiacao}
              ghiSeries={locGhiSeries}
              latitude={locLatitude}
              somenteGhi={locSkipPoa}
            />
          </>
        ));

      case STEP_KEYS.CAMPOS_PRE:
        return wrap("campos_pre", (
          <StepCamposCustomizados values={customFieldValues} onValuesChange={setCustomFieldValues} />
        ));

      case STEP_KEYS.KIT: {
        const kitVal = validateKit(itens, potenciaKwp, venda.custo_kit_override);
        return wrap("kit", (
          <div className="space-y-4">
            <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} otimizadores={otimizadores} baterias={baterias} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} preDimensionamento={preDimensionamento} onPreDimensionamentoChange={setPreDimensionamento} consumoTotal={consumoTotal} manualKits={manualKits} onManualKitsChange={setManualKits} irradiacao={locIrradiacao} latitude={locLatitude} ghiSeries={locGhiSeries} somenteGhi={locSkipPoa} custoKitOverride={venda.custo_kit_override} ibgeCodigo={clienteMunicipioIbgeCodigo ?? solarPremises?.solaryum_ibge_fallback ?? null} />
            {(kitVal?.warnings ?? []).length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-1">
                {(kitVal?.warnings ?? []).map((w, i) => (
                  <p key={i} className="text-xs text-warning font-medium flex items-center gap-1.5">
                    <span className="shrink-0">⚠</span> {w}
                  </p>
                ))}
              </div>
            )}
            {(kitVal?.errors ?? []).length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                {(kitVal?.errors ?? []).map((e, i) => (
                  <p key={i} className="text-xs text-destructive font-medium flex items-center gap-1.5">
                    <span className="shrink-0">✕</span> {e}
                  </p>
                ))}
              </div>
            )}
          </div>
        ));
      }

      case STEP_KEYS.ADICIONAIS:
        return wrap("adicionais", (
          <StepAdicionais
            adicionais={adicionais}
            onAdicionaisChange={setAdicionais}
            itens={itens}
            onItensChange={setItens}
            layouts={layouts}
            onLayoutsChange={setLayouts}
            modulos={modulos}
            inversores={inversores}
          />
        ));

      case STEP_KEYS.SERVICOS:
        return wrap("servicos", (
          <StepServicos servicos={servicos} onServicosChange={setServicos} kitItens={itens} potenciaKwp={potenciaKwp} custoKitOverride={venda.custo_kit_override} />
        ));

      case STEP_KEYS.VENDA:
        return wrap("venda", (
          <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} leadId={selectedLead?.id} />
        ));

      case STEP_KEYS.PAGAMENTO:
        return wrap("pagamento", (
          <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} ucs={ucs} premissas={premissas} potenciaKwp={potenciaKwp} irradiacao={locIrradiacao} geracaoMensalKwh={geracaoMensalEstimada} />
        ));

      case STEP_KEYS.RESUMO:
        return wrap("resumo", (
          <StepResumo
            estado={locEstado}
            cidade={locCidade}
            tipoTelhado={locTipoTelhado}
            distribuidoraNome={locDistribuidoraNome}
            irradiacao={locIrradiacao}
            clienteNome={cliente.nome || ""}
            clienteCelular={cliente.celular || ""}
            clienteEmail={cliente.email || ""}
            clienteEmpresa={cliente.empresa || ""}
            leadNome={selectedLead?.nome || ""}
            potenciaKwp={potenciaKwp}
            consumoTotal={consumoTotal}
            geracaoMensalKwh={geracaoMensalEstimada}
            numUcs={ucs.length}
            grupo={grupo}
            itens={itens}
            custoKitOverride={venda.custo_kit_override}
            adicionais={adicionais}
            servicos={servicos}
            precoFinal={precoFinal}
            margemPercentual={venda.margem_percentual}
            custoInstalacao={venda.custo_instalacao}
            custoComissao={venda.custo_comissao}
            custoOutros={venda.custo_outros}
            descontoPercentual={venda.desconto_percentual}
            pagamentoOpcoes={pagamentoOpcoes}
          />
        ));

      case STEP_KEYS.PROPOSTA:
        return wrap("proposta", (
          <>
            {/* Enforcement: EstimativaCheckbox before generation */}
            <EstimativaCheckbox
              precisao={enforcement.precisao}
              checked={enforcement.aceiteEstimativa}
              onCheckedChange={enforcement.setAceiteEstimativa}
              className="mb-4"
            />
            <StepDocumento
              clienteNome={cliente.nome || selectedLead?.nome || ""}
              empresaNome={cliente.empresa || cliente.nome || selectedLead?.nome || ""}
              clienteTelefone={cliente.celular || selectedLead?.telefone || ""}
              clienteEmail={cliente.email || ""}
              potenciaKwp={potenciaKwp}
              areaUtilM2={areaUtilEstimada}
              geracaoMensalKwh={geracaoMensalEstimada}
              numUcs={ucs.length}
              precoFinal={precoFinal}
              templateSelecionado={templateSelecionado}
              onTemplateSelecionado={handleTemplateChange}
              generating={generating}
              rendering={rendering}
              result={result}
              htmlPreview={htmlPreview}
              pdfBlobUrl={pdfBlobUrl}
              outputDocxPath={outputDocxPath}
              outputPdfPath={outputPdfPath}
              generationStatus={generationStatus}
              generationError={generationError}
              missingVars={missingVars}
              onGenerate={handlePreGenerate}
              onNewVersion={handleNewVersion}
              onViewDetail={handleViewDetail}
              customFieldValues={customFieldValues}
              onCustomFieldValuesChange={setCustomFieldValues}
              docxBlob={docxBlob}
              generationAuditReport={generationAuditReport}
              estimativaBlocked={enforcement.precisao === "estimado" && !enforcement.aceiteEstimativa}
            />
          </>
        ));

      default:
        return null;
    }
  };

  // ─── Render
  return (
    <div className="proposal-wizard-root flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* ── Sticky Header — breadcrumb + client + metrics */}
      <div className="shrink-0 border-b border-border/60 bg-card px-4 lg:px-6 py-2.5 space-y-1">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Button variant="link" size="sm" className="p-0 h-auto text-[11px] text-muted-foreground hover:text-foreground" onClick={() => navigate("/admin/propostas-nativas")}>
            Propostas
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {savedProjetoId && (
            <>
              <Button variant="link" size="sm" className="p-0 h-auto text-[11px] text-muted-foreground hover:text-foreground" onClick={() => navigate(`/admin/projetos/${savedProjetoId}`)}>
                Projeto
              </Button>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            </>
          )}
          <span className="font-medium text-foreground">
            {savedPropostaId ? "Proposta" : "Nova Proposta"}
          </span>
        </div>

        {/* Client name + metrics row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-foreground truncate">
            {cliente.nome || selectedLead?.nome || (savedPropostaId ? "Editar Proposta" : "Nova Proposta")}
          </h1>
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {potenciaKwp > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Potência Total</p>
                  <p className="text-xs font-bold text-foreground">{(Number(potenciaKwp) || 0).toFixed(2)} kWp</p>
                </div>
              </div>
            )}
            {consumoTotal > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <BarChart3 className="h-3.5 w-3.5 text-secondary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Consumo</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(consumoTotal)} kWh</p>
                </div>
              </div>
            )}
            {geracaoMensalEstimada > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <SunMedium className="h-3.5 w-3.5 text-warning" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Geração Estimada</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(Math.round(geracaoMensalEstimada))} kWh/mês</p>
                </div>
              </div>
            )}
            {precoFinal > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Preço do Projeto</p>
                  <p className="text-xs font-bold text-foreground">
                    {formatBRL(precoFinal)}{" "}
                    {potenciaKwp > 0 && (
                      <span className="text-[9px] font-normal text-muted-foreground">
                        R$ {((Number(precoFinal) || 0) / (Number(potenciaKwp) || 1) / 1000).toFixed(2)}/Wp
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Context Banner */}
      {projectContext && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 border-b border-primary/20 bg-primary/5 shrink-0">
          <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-[11px] font-medium text-primary">
            Proposta vinculada ao projeto — dados carregados automaticamente
          </p>
        </div>
      )}

      {/* Sent Proposal Warning Banner */}
      {editingsentProposal && (
        <div className="flex items-center gap-2 px-4 lg:px-6 py-2 border-b border-warning/30 bg-warning/10 shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <p className="text-[11px] font-medium text-warning">
            Essa proposta já foi enviada/gerada. Ao salvar, uma nova versão será criada com um novo link.
          </p>
        </div>
      )}

      {/* ── Pipeline stepper — responsive: scrollable on mobile, full on desktop */}
      <div className="relative shrink-0 border-b-2 border-secondary/10 bg-gradient-to-b from-card to-muted/20">
        {/* Progress track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-secondary to-primary rounded-r-full shadow-sm shadow-secondary/30"
            initial={{ width: "0%" }}
            animate={{ width: `${((step) / (activeSteps.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
        {/* Scrollable container on mobile */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center px-2 sm:px-4 py-3 gap-0 min-w-max sm:min-w-0 sm:justify-center lg:justify-start">
            {activeSteps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.key} className="flex items-center flex-shrink-0">
                  <motion.button
                    onClick={() => { if (isDone) goToStep(i); }}
                    className={cn(
                      "relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap border",
                      isActive && "bg-primary text-primary-foreground shadow-sm border-primary",
                      isDone && "bg-secondary/10 text-secondary border-secondary/20 cursor-pointer hover:bg-secondary/15",
                      !isActive && !isDone && "text-muted-foreground border-transparent cursor-default",
                    )}
                    initial={false}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    whileHover={isDone ? { scale: 1.02 } : undefined}
                  >
                    <span className={cn(
                      "flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[10px] shrink-0 transition-colors",
                      isActive && "bg-primary-foreground/25",
                      isDone && "bg-secondary/20 text-secondary",
                      !isActive && !isDone && "bg-muted",
                    )}>
                      {isDone ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                          <Check className="h-3 w-3" />
                        </motion.span>
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </span>
                    {/* Show labels on md+ screens */}
                    <span className="hidden md:block">{s.label}</span>
                  </motion.button>
                  {i < activeSteps.length - 1 && (
                    <div className="flex items-center mx-0.5 sm:mx-1">
                      <ChevronRight className={cn(
                        "h-3 w-3 sm:h-4 sm:w-4 transition-colors duration-300",
                        isDone ? "text-secondary" : "text-muted-foreground/30",
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body: Content — responsive padding, max-width for readability */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="w-full px-2 sm:px-3 lg:px-4 py-2 lg:py-3 pb-24 sm:pb-20">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>

          {/* Audit Panel — visible in debug mode */}
          {debugMode && (
            <div className="mt-4">
              <ProposalAuditPanel
                snapshot={collectSnapshot()}
                propostaId={savedPropostaId}
                versaoId={savedVersaoId}
                projetoId={savedProjetoId || null}
                dealId={resolvedDealId || dealIdFromUrl || null}
                clienteId={customerIdFromUrl || null}
                leadId={selectedLead?.id || leadIdFromUrl || null}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Footer Navigation — responsive */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-auto flex items-center justify-between px-4 lg:px-6 py-3 border-t border-border/60 bg-card shrink-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:shadow-none">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 h-9 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            Cancelar
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
              Etapa {step + 1}/{activeSteps.length}
            </span>

            {isAdminOrGerente && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2">
                <Switch id="debug-toggle" checked={debugMode} onCheckedChange={setDebugMode} className="scale-75" />
                <Label htmlFor="debug-toggle" className="text-[10px] text-muted-foreground cursor-pointer select-none">Debug</Label>
              </div>
            )}

            <div className="h-6 w-px bg-border/50 hidden sm:block" />

            <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1.5 h-9 text-xs font-medium">
              <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voltar</span>
            </Button>
            {!isLastStep && (
              <Button
                size="sm"
                onClick={goNext}
                disabled={!canCurrentStep}
                className="gap-1.5 h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200"
              >
                Prosseguir
              </Button>
            )}
            {isLastStep && (savedDealId || resolvedDealId) && (
              <Button
                size="sm"
                onClick={() => {
                  const targetId = savedDealId || resolvedDealId;
                  if (targetId) navigate(`/admin/projetos?projeto=${targetId}&tab=propostas`);
                }}
                className="gap-1.5 h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200"
              >
                Prosseguir
              </Button>
            )}
          </div>
        </div>

      {/* Pos-dimensionamento dialog */}
      <DialogPosDimensionamento
        open={showPosDialog}
        onOpenChange={setShowPosDialog}
        clienteNome={cliente.nome || selectedLead?.nome || ""}
        empresaNome={cliente.empresa || cliente.nome || selectedLead?.nome || ""}
        potenciaKwp={potenciaKwp}
        precoFinal={precoFinal}
        nomeProposta={nomeProposta}
        onNomePropostaChange={setNomeProposta}
        descricaoProposta={descricaoProposta}
        onDescricaoPropostaChange={setDescricaoProposta}
        customFieldValues={customFieldValues}
        onCustomFieldValuesChange={setCustomFieldValues}
        financialWarnings={resumoFinancialWarnings}
        onConfirm={handlePosDialogConfirm}
        onSaveDraft={() => handleUpdate(false)}
        onSaveActive={() => handleUpdate(true)}
        saving={saving || isRestoring}
        savedPropostaId={savedPropostaId || propostaIdFromUrl}
      />

      {/* Enforcement: block modal */}
      <MissingVariablesModal
        open={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        missingVariables={blockMissing}
        reason={blockReason}
      />

      {/* Pre-generation gate modal */}
      {gateValidation && (
        <PreGenerationGateModal
          open={showGateModal}
          onOpenChange={setShowGateModal}
          validation={gateValidation}
          onConfirmGenerate={handleGateConfirmed}
        />
      )}
    </div>
  );
}
