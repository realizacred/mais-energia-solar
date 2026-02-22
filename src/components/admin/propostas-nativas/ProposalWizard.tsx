// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MapPin, User, BarChart3, Settings2, Package,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu, Link2, ClipboardList, Box,
  Zap, AlertTriangle, Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";
import { cn } from "@/lib/utils";
import { useSolarPremises } from "@/hooks/useSolarPremises";
import { useProposalEnforcement } from "@/hooks/useProposalEnforcement";
import {
  useEquipmentCatalog, useBancosCatalog, useSolarBrainSync,
  useTenantTarifas, useCustomFieldsAvailability, applyTenantTarifasToUC,
} from "./wizard/useWizardDataLoaders";
import { validateGrupoConsistency } from "@/lib/validateGrupoConsistency";
import type { ProposalResolverContext } from "@/lib/resolveProposalVariables";

// ── Step Components
import { StepLocalizacao } from "./wizard/StepLocalizacao";
import { StepCliente } from "./wizard/StepCliente";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepCamposCustomizados } from "./wizard/StepCamposCustomizados";
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepAdicionais, type AdicionalItem } from "./wizard/StepAdicionais";
import { StepServicos } from "./wizard/StepServicos";
import { StepFinancialCenter, calcPrecoFinal } from "./wizard/StepFinancialCenter";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepDocumento } from "./wizard/StepDocumento";
import { DialogPosDimensionamento } from "./wizard/DialogPosDimensionamento";
import { WizardSidebar, type WizardStep } from "./wizard/WizardSidebar";
import { WizardStepCard } from "./wizard/WizardStepCard";
import { useSavedFeedback, SavedFeedbackInline } from "./wizard/SavedFeedback";
import { EstimativaCheckbox } from "./wizard/EstimativaCheckbox";
import { MissingVariablesModal } from "./wizard/MissingVariablesModal";

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
  PROPOSTA: "proposta",
} as const;

const BASE_STEPS: WizardStep[] = [
  { key: STEP_KEYS.LOCALIZACAO, label: "Localização", icon: MapPin },
  { key: STEP_KEYS.UCS, label: "Unidades Consumidoras", icon: Zap },
  { key: STEP_KEYS.CAMPOS_PRE, label: "Campos Customizados", icon: ClipboardList, conditional: true },
  { key: STEP_KEYS.KIT, label: "Kit Gerador", icon: Package },
  { key: STEP_KEYS.ADICIONAIS, label: "Adicionais", icon: Box },
  { key: STEP_KEYS.SERVICOS, label: "Serviços", icon: Wrench },
  { key: STEP_KEYS.VENDA, label: "Venda", icon: DollarSign },
  { key: STEP_KEYS.PAGAMENTO, label: "Formas de pagamento", icon: CreditCard },
  { key: STEP_KEYS.PROPOSTA, label: "Proposta", icon: FileText },
];

/** Step card metadata — title + helper text for each step */
const STEP_META: Record<string, { title: string; description: string }> = {
  [STEP_KEYS.LOCALIZACAO]: { title: "Localização e Cliente", description: "Defina o endereço do projeto e selecione o cliente ou lead." },
  [STEP_KEYS.UCS]: { title: "Unidades Consumidoras", description: "Configure as UCs, tarifas e dimensionamento do sistema." },
  [STEP_KEYS.CAMPOS_PRE]: { title: "Campos Customizados", description: "Preencha os campos adicionais configurados para sua empresa." },
  [STEP_KEYS.KIT]: { title: "Kit Gerador", description: "Monte o kit com módulos, inversores e demais equipamentos." },
  [STEP_KEYS.ADICIONAIS]: { title: "Itens Adicionais", description: "Adicione baterias, otimizadores e outros componentes extras." },
  [STEP_KEYS.SERVICOS]: { title: "Serviços", description: "Configure mão de obra, frete e serviços inclusos ou extras." },
  [STEP_KEYS.VENDA]: { title: "Centro Financeiro", description: "Defina margens, comissões e precificação final do projeto." },
  [STEP_KEYS.PAGAMENTO]: { title: "Formas de Pagamento", description: "Configure opções de pagamento, financiamentos e parcelamentos." },
  [STEP_KEYS.PROPOSTA]: { title: "Gerar Proposta", description: "Revise os dados e gere o documento final da proposta comercial." },
};

const IDEM_KEY_PREFIX = "proposal_idem_";

function getOrCreateIdempotencyKey(leadId: string): string {
  const k = `${IDEM_KEY_PREFIX}${leadId}`;
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(k, created);
  return created;
}

function clearIdempotencyKey(leadId: string) {
  localStorage.removeItem(`${IDEM_KEY_PREFIX}${leadId}`);
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
  console.log("[ProposalWizard] Component render start");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get("deal_id");
  const customerIdFromUrl = searchParams.get("customer_id");
  const leadIdFromUrl = searchParams.get("lead_id");
  const orcIdFromUrl = searchParams.get("orc_id");
  const [step, setStep] = useState(0);
  const [projectContext, setProjectContext] = useState<{ dealId: string; customerId: string } | null>(null);

  // ─── Custom fields availability (extracted hook)
  const { hasCustomFieldsPre } = useCustomFieldsAvailability();

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

  // UCs
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Custom Fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Premissas
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Kit (extracted hooks)
  const { modulos, inversores, otimizadores, loadingEquip } = useEquipmentCatalog();
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

  // Pagamento
  const [pagamentoOpcoes, setPagamentoOpcoes] = useState<PagamentoOpcao[]>([]);
  const { bancos, loadingBancos } = useBancosCatalog();

  // Proposta (Documento)
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
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

  // ─── Derived
  const precoFinal = useMemo(() => calcPrecoFinal(itens, servicos, venda), [itens, servicos, venda]);
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // ─── Grupo consistency validation
  const grupoValidation = useMemo(() => validateGrupoConsistency(ucs), [ucs]);
  const isGrupoMixed = !grupoValidation.valid && grupoValidation.error === "mixed_grupos";
  const isGrupoUndefined = !grupoValidation.valid && grupoValidation.error === "grupo_indefinido";

  // ─── Enforcement: resolver context
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
    geracaoMensal: potenciaKwp > 0 && locIrradiacao > 0
      ? Math.round(potenciaKwp * locIrradiacao * 30 * 0.80) : undefined,
    precoTotal: precoFinal,
    consultorNome: undefined, // filled by backend
  }), [cliente, selectedLead, ucs, premissas, potenciaKwp, locIrradiacao, precoFinal, locCidade, locEstado]);

  const enforcement = useProposalEnforcement(resolverContext);

  // Estimated generation (kWh/month) = potência * irradiação * 30 * PR(0.80)
  const geracaoMensalEstimada = useMemo(() => {
    if (potenciaKwp > 0 && locIrradiacao > 0) {
      return Math.round(potenciaKwp * locIrradiacao * 30 * 0.80);
    }
    return 0;
  }, [potenciaKwp, locIrradiacao]);

  // Estimated area (m²) from module items — ~2m² per module panel
  const areaUtilEstimada = useMemo(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    const totalPaineis = modulosNoKit.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    return totalPaineis > 0 ? Math.round(totalPaineis * 2) : 0;
  }, [itens]);

  // ─── Data fetching (extracted hooks)
  useSolarBrainSync(setPremissas, setPreDimensionamento);
  const tenantTarifas = useTenantTarifas();

  // Apply tenant tariff defaults to UCs that still have zero values
  useEffect(() => {
    if (!tenantTarifas) return;
    setUcs(prev => {
      const needsUpdate = prev.some(u =>
        u.tarifa_distribuidora === 0 && u.tarifa_te_p === 0 && u.tarifa_te_fp === 0
      );
      if (!needsUpdate) return prev;
      return prev.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas]);

  // Wrapper: auto-apply tenant tariff defaults when UCs change (e.g. new UC added)
  const handleUcsChange = useCallback((newUcs: UCData[] | ((prev: UCData[]) => UCData[])) => {
    setUcs(prev => {
      const resolved = typeof newUcs === "function" ? newUcs(prev) : newUcs;
      if (!tenantTarifas) return resolved;
      return resolved.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas]);

  // ─── Auto-load from project context
  useEffect(() => {
    if (!customerIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email, cpf_cnpj, empresa, cep, rua, numero, complemento, bairro, cidade, estado, lead_id")
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

        if (cli.estado) setLocEstado(cli.estado);
        if (cli.cidade) setLocCidade(cli.cidade);

        if (dealIdFromUrl) {
          setProjectContext({ dealId: dealIdFromUrl, customerId: customerIdFromUrl });
        }

        if (cli.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado")
            .eq("id", cli.lead_id)
            .single();
          if (!cancelled && lead) {
            const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
            });
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
    // If ORC is present, only load lead for context (name/phone) — ORC handles location
    const orcTakesPriority = !!orcIdFromUrl;
    let cancelled = false;
    (async () => {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento")
          .eq("id", leadIdFromUrl)
          .single();
        if (cancelled || !lead) return;

        setSelectedLead({
          id: lead.id, nome: lead.nome, telefone: lead.telefone,
          lead_code: lead.lead_code || "", estado: lead.estado,
          cidade: lead.cidade, media_consumo: lead.media_consumo,
          tipo_telhado: lead.tipo_telhado,
        });

        // When ORC is present, skip location pre-fill — ORC data has priority
        if (!orcTakesPriority) {
          if (lead.estado) setLocEstado(lead.estado);
          if (lead.cidade) setLocCidade(lead.cidade);
          const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
          if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

          const consumo = lead.consumo_previsto || lead.media_consumo || 0;
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
        const consumo = orc.consumo_previsto || orc.media_consumo || 0;
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
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado")
            .eq("id", orc.lead_id)
            .single();
          if (!cancelled && lead) {
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
            });
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
    if (lead.estado) setLocEstado(lead.estado);
    if (lead.cidade) setLocCidade(lead.cidade);
    const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
    if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

    const faseData = redeAtendimentoToFaseTensao(lead.rede_atendimento);
    const consumo = lead.consumo_kwh || lead.media_consumo || 0;

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
    [STEP_KEYS.KIT]: itens.length > 0 && itens.some(i => i.descricao),
    [STEP_KEYS.ADICIONAIS]: true,
    [STEP_KEYS.SERVICOS]: true,
    [STEP_KEYS.VENDA]: venda.margem_percentual >= 0,
    [STEP_KEYS.PAGAMENTO]: true,
    [STEP_KEYS.PROPOSTA]: grupoValidation.valid,
  };

  const canCurrentStep = canAdvance[currentStepKey] ?? true;

  // ─── Generate (with enforcement gate)
  const handleGenerate = async () => {
    if (!selectedLead) return;

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
    const gate = enforcement.checkGate();
    if (!gate.allowed) {
      setBlockReason(gate.reason!);
      setBlockMissing(gate.missingVariables || []);
      setShowBlockModal(true);
      enforcement.logBlock(null, gate.reason!, gate.missingVariables || []);
      return;
    }

    setGenerating(true);
    setHtmlPreview(null);
    setResult(null);

    try {
      const idempotencyKey = getOrCreateIdempotencyKey(selectedLead.id);
      const payload: GenerateProposalPayload = {
        lead_id: selectedLead.id,
        projeto_id: projectContext?.dealId || dealIdFromUrl || undefined,
        grupo: grupoValidation.grupo || (grupo.startsWith("B") ? "B" : "A"),
        idempotency_key: idempotencyKey,
        template_id: templateSelecionado || undefined,
        potencia_kwp: potenciaKwp,
        ucs: ucs.map(({ id, uc_index, ...rest }) => rest),
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
        aceite_estimativa: enforcement.aceiteEstimativa || undefined,
      };

      const genResult = await generateProposal(payload);
      setResult(genResult);

      // Audit is now persisted by the backend — no need for frontend persistAudit

      setRendering(true);
      try {
        const renderResult = await renderProposal(genResult.versao_id);
        setHtmlPreview(renderResult.html);
      } catch (e: any) {
        toast({ title: "Erro ao renderizar", description: e.message, variant: "destructive" });
      } finally { setRendering(false); }

      toast({ title: "Proposta gerada!", description: `Versão ${genResult.versao_numero} criada.` });
    } catch (e: any) {
      // ── Handle structured 422 errors from backend enforcement ──
      const errorCode = (e as any).errorCode;
      if (errorCode === "missing_required_variables") {
        setBlockReason("missing_required");
        setBlockMissing((e as any).missing || []);
        setShowBlockModal(true);
        return;
      }
      if (errorCode === "estimativa_not_accepted") {
        setBlockReason("estimativa_not_accepted");
        setBlockMissing([]);
        setShowBlockModal(true);
        return;
      }
      if (errorCode === "mixed_grupos" || errorCode === "grupo_indefinido") {
        toast({
          title: "Erro de grupo tarifário",
          description: e.message || "Não é permitido misturar Grupo A e Grupo B na mesma proposta.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Erro ao gerar proposta", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleNewVersion = () => {
    if (selectedLead) clearIdempotencyKey(selectedLead.id);
    setResult(null);
    setHtmlPreview(null);
    // Go back to UCs step
    const ucsIndex = activeSteps.findIndex(s => s.key === STEP_KEYS.UCS);
    setStep(ucsIndex >= 0 ? ucsIndex : 1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const goToStep = (target: number) => {
    setStep(target);
  };

  const goNext = () => {
    if (step >= activeSteps.length - 1) return;
    // Intercept: when advancing FROM Pagamento → show pos-dimensionamento dialog
    const nextKey = activeSteps[step + 1]?.key;
    if (currentStepKey === STEP_KEYS.PAGAMENTO && nextKey === STEP_KEYS.PROPOSTA) {
      // Auto-fill nome if empty
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
    console.log("[ProposalWizard] renderStepContent, currentStepKey:", currentStepKey);

    const wrap = (key: string, children: React.ReactNode, headerRight?: React.ReactNode) => (
      <StepContent key={key}>
        <WizardStepCard
          title={stepMeta.title}
          description={stepMeta.description}
          icon={currentStepDef?.icon}
          headerRight={headerRight}
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
            />
          </>
        ));

      case STEP_KEYS.CAMPOS_PRE:
        return wrap("campos_pre", (
          <StepCamposCustomizados values={customFieldValues} onValuesChange={setCustomFieldValues} />
        ));

      case STEP_KEYS.KIT:
        return wrap("kit", (
          <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} otimizadores={otimizadores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} preDimensionamento={preDimensionamento} onPreDimensionamentoChange={setPreDimensionamento} consumoTotal={consumoTotal} manualKits={manualKits} onManualKitsChange={setManualKits} />
        ));

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
          <StepServicos servicos={servicos} onServicosChange={setServicos} kitItens={itens} potenciaKwp={potenciaKwp} />
        ));

      case STEP_KEYS.VENDA:
        return wrap("venda", (
          <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} />
        ));

      case STEP_KEYS.PAGAMENTO:
        return wrap("pagamento", (
          <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} ucs={ucs} premissas={premissas} potenciaKwp={potenciaKwp} irradiacao={locIrradiacao} />
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
              onTemplateSelecionado={setTemplateSelecionado}
              generating={generating}
              rendering={rendering}
              result={result}
              htmlPreview={htmlPreview}
              onGenerate={handleGenerate}
              onNewVersion={handleNewVersion}
              onViewDetail={handleViewDetail}
              customFieldValues={customFieldValues}
              onCustomFieldValuesChange={setCustomFieldValues}
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
      {/* ── Sticky Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="h-4 w-px bg-border shrink-0" />
          <h1 className="text-sm font-bold truncate">Nova Proposta</h1>
          {selectedLead && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary shrink-0 hidden sm:inline-flex">
              {selectedLead.nome}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {potenciaKwp > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold text-foreground">{potenciaKwp.toFixed(2)} kWp</span>
            </div>
          )}
          {consumoTotal > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-secondary" />
              <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh</span>
            </div>
          )}
          {precoFinal > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-success" />
              <span className="font-bold text-foreground">{formatBRL(precoFinal)}</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full shrink-0">
            {step + 1}/{activeSteps.length}
          </span>
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
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-2 sm:px-3 lg:px-4 py-2 lg:py-3 pb-24 sm:pb-20">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Sticky Footer Navigation — responsive */}
      {!result && (
        <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-auto flex items-center justify-between px-4 lg:px-6 py-3 border-t border-border/60 bg-card shrink-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:shadow-none">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 h-9 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            Cancelar
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
              Etapa {step + 1}/{activeSteps.length}
            </span>
            <Button variant="outline" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1.5 h-9 text-xs font-medium">
              <ChevronLeft className="h-3.5 w-3.5" /> Voltar
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
          </div>
        </div>
      )}

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
        onConfirm={handlePosDialogConfirm}
      />

      {/* Enforcement: block modal */}
      <MissingVariablesModal
        open={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        missingVariables={blockMissing}
        reason={blockReason}
      />
    </div>
  );
}
