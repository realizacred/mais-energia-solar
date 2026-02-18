// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MapPin, User, BarChart3, Settings2, Package,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu, Link2, ClipboardList, Box,
  Zap,
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
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  );
}

// ─── Helper: apply tenant tariff defaults to a UC ──────────
function applyTenantTarifasToUC(
  uc: UCData,
  t: {
    tarifa: number; tusd_fio_b_bt: number;
    tarifa_te_ponta: number; tarifa_tusd_ponta: number; tusd_fio_b_ponta: number;
    tarifa_te_fora_ponta: number; tarifa_tusd_fora_ponta: number; tusd_fio_b_fora_ponta: number;
    tarifacao_compensada_bt: number; tarifacao_compensada_ponta: number; tarifacao_compensada_fora_ponta: number;
    imposto_energia: number; fator_simultaneidade: number;
    preco_demanda: number; preco_demanda_geracao: number;
    outros_encargos_atual: number; outros_encargos_novo: number;
    concessionaria_nome?: string; concessionaria_id?: string;
  },
): UCData {
  return {
    ...uc,
    // Concessionária (se UC ainda não tem)
    distribuidora: uc.distribuidora || t.concessionaria_nome || "",
    distribuidora_id: uc.distribuidora_id || t.concessionaria_id || "",
    // Grupo B
    tarifa_distribuidora: uc.tarifa_distribuidora || t.tarifa || 0,
    tarifa_fio_b: uc.tarifa_fio_b || t.tusd_fio_b_bt || 0,
    // Grupo A - Ponta
    tarifa_te_p: uc.tarifa_te_p || t.tarifa_te_ponta || 0,
    tarifa_tusd_p: uc.tarifa_tusd_p || t.tarifa_tusd_ponta || 0,
    tarifa_fio_b_p: uc.tarifa_fio_b_p || t.tusd_fio_b_ponta || 0,
    tarifa_tarifacao_p: uc.tarifa_tarifacao_p || t.tarifacao_compensada_ponta || 0,
    // Grupo A - Fora Ponta
    tarifa_te_fp: uc.tarifa_te_fp || t.tarifa_te_fora_ponta || 0,
    tarifa_tusd_fp: uc.tarifa_tusd_fp || t.tarifa_tusd_fora_ponta || 0,
    tarifa_fio_b_fp: uc.tarifa_fio_b_fp || t.tusd_fio_b_fora_ponta || 0,
    tarifa_tarifacao_fp: uc.tarifa_tarifacao_fp || t.tarifacao_compensada_fora_ponta || 0,
    // Demanda (R$)
    demanda_consumo_rs: uc.demanda_consumo_rs || t.preco_demanda || 0,
    demanda_geracao_rs: uc.demanda_geracao_rs || t.preco_demanda_geracao || 0,
    // Encargos
    outros_encargos_atual: uc.outros_encargos_atual || t.outros_encargos_atual || 0,
    outros_encargos_novo: uc.outros_encargos_novo || t.outros_encargos_novo || 0,
    // Fiscal
    imposto_energia: uc.imposto_energia || t.imposto_energia || 0,
    fator_simultaneidade: uc.fator_simultaneidade || t.fator_simultaneidade || 30,
  };
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

  // ─── Custom fields availability (conditional steps)
  const [hasCustomFieldsPre, setHasCustomFieldsPre] = useState(false);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  useEffect(() => {
    supabase
      .from("deal_custom_fields")
      .select("id, field_context")
      .eq("is_active", true)
      .then(({ data }) => {
        const fields = data || [];
        setHasCustomFieldsPre(fields.some(f => f.field_context === "pre_dimensionamento") || fields.length > 0);
        setLoadingCustomFields(false);
      });
  }, []);

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
  const [mapSnapshots, setMapSnapshots] = useState<string[]>([]);
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

  // Kit
  const [modulos, setModulos] = useState<any[]>([]);
  const [inversores, setInversores] = useState<any[]>([]);
  const [otimizadores, setOtimizadores] = useState<any[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);

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
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);

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
  const [descricaoProposta, setDescricaoProposta] = useState("");

  // ─── Derived
  const precoFinal = useMemo(() => calcPrecoFinal(itens, servicos, venda), [itens, servicos, venda]);
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

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

  // ─── Data fetching
  useEffect(() => {
    setLoadingEquip(true);
    Promise.all([
      supabase.from("modulos_solares").select("id, fabricante, modelo, potencia_wp, tipo_celula, eficiencia_percent").eq("ativo", true).order("potencia_wp", { ascending: false }),
      supabase.from("inversores_catalogo").select("id, fabricante, modelo, potencia_nominal_kw, tipo, mppt_count, fases").eq("ativo", true).order("potencia_nominal_kw", { ascending: false }),
      supabase.from("otimizadores_catalogo").select("id, fabricante, modelo, potencia_wp, eficiencia_percent, compatibilidade").eq("ativo", true).order("fabricante"),
    ]).then(([modRes, invRes, otimRes]) => {
      setModulos(modRes.data || []);
      setInversores(invRes.data || []);
      setOtimizadores(otimRes.data || []);
      setLoadingEquip(false);
    });
  }, []);

  useEffect(() => {
    setLoadingBancos(true);
    supabase.rpc("get_active_financing_banks").then(({ data }) => {
      setBancos((data || []) as BancoFinanciamento[]);
      setLoadingBancos(false);
    });
  }, []);

  // Load premissas from Solar Brain
  const { data: solarBrain } = useSolarPremises();

  // Tenant tariff defaults (loaded once from tenant_premises)
  const [tenantTarifas, setTenantTarifas] = useState<{
    tarifa: number; tusd_fio_b_bt: number;
    tarifa_te_ponta: number; tarifa_tusd_ponta: number; tusd_fio_b_ponta: number;
    tarifa_te_fora_ponta: number; tarifa_tusd_fora_ponta: number; tusd_fio_b_fora_ponta: number;
    tarifacao_compensada_bt: number; tarifacao_compensada_ponta: number; tarifacao_compensada_fora_ponta: number;
    imposto_energia: number; fator_simultaneidade: number;
    preco_demanda: number; preco_demanda_geracao: number;
    outros_encargos_atual: number; outros_encargos_novo: number;
    fase_tensao_rede: string; grupo_tarifario: string;
    concessionaria_nome?: string; concessionaria_id?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: tp } = await supabase
        .from("tenant_premises")
        .select(
          "tarifa, tusd_fio_b_bt, tarifa_te_ponta, tarifa_tusd_ponta, tusd_fio_b_ponta, " +
          "tarifa_te_fora_ponta, tarifa_tusd_fora_ponta, tusd_fio_b_fora_ponta, " +
          "tarifacao_compensada_bt, tarifacao_compensada_ponta, tarifacao_compensada_fora_ponta, " +
          "imposto_energia, fator_simultaneidade, fase_tensao_rede, grupo_tarifario, " +
          "preco_demanda, preco_demanda_geracao, outros_encargos_atual, outros_encargos_novo, " +
          "concessionaria_id"
        )
        .limit(1)
        .maybeSingle();

      if (!tp) return;

      const tpAny = tp as any;

      // Buscar nome da concessionária se houver concessionaria_id
      let concNome = "";
      const concId = tpAny.concessionaria_id as string | null;
      if (concId) {
        const { data: conc } = await supabase
          .from("concessionarias")
          .select("nome")
          .eq("id", concId)
          .maybeSingle();
        concNome = conc?.nome || "";
      }

      setTenantTarifas({
        ...tpAny,
        concessionaria_nome: concNome,
        concessionaria_id: concId || undefined,
      });
    })();
  }, []);

  useEffect(() => {
    if (!solarBrain) return;
    setPremissas(prev => ({
      ...prev,
      imposto: solarBrain.imposto_energia ?? prev.imposto,
      inflacao_energetica: solarBrain.inflacao_energetica ?? prev.inflacao_energetica,
      perda_eficiencia_anual: solarBrain.perda_eficiencia ?? prev.perda_eficiencia_anual,
      sobredimensionamento: solarBrain.sobredimensionamento ?? prev.sobredimensionamento,
    }));
    // Sync preDimensionamento with tenant sobredimensionamento
    setPreDimensionamento(prev => ({
      ...prev,
      sobredimensionamento: solarBrain.sobredimensionamento ?? prev.sobredimensionamento,
    }));
  }, [solarBrain]);

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
    [STEP_KEYS.UCS]: consumoTotal > 0,
    [STEP_KEYS.CAMPOS_PRE]: true,
    [STEP_KEYS.KIT]: itens.length > 0 && itens.some(i => i.descricao),
    [STEP_KEYS.ADICIONAIS]: true,
    [STEP_KEYS.SERVICOS]: true,
    [STEP_KEYS.VENDA]: venda.margem_percentual >= 0,
    [STEP_KEYS.PAGAMENTO]: true,
    [STEP_KEYS.PROPOSTA]: true,
  };

  const canCurrentStep = canAdvance[currentStepKey] ?? true;

  // ─── Generate
  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setHtmlPreview(null);
    setResult(null);

    try {
      const idempotencyKey = getOrCreateIdempotencyKey(selectedLead.id);
      const payload: GenerateProposalPayload = {
        lead_id: selectedLead.id,
        projeto_id: projectContext?.dealId || dealIdFromUrl || undefined,
        grupo: grupo.startsWith("B") ? "B" : "A",
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
      };

      const genResult = await generateProposal(payload);
      setResult(genResult);

      setRendering(true);
      try {
        const renderResult = await renderProposal(genResult.versao_id);
        setHtmlPreview(renderResult.html);
      } catch (e: any) {
        toast({ title: "Erro ao renderizar", description: e.message, variant: "destructive" });
      } finally { setRendering(false); }

      toast({ title: "Proposta gerada!", description: `Versão ${genResult.versao_numero} criada.` });
    } catch (e: any) {
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
  const renderStepContent = () => {
    console.log("[ProposalWizard] renderStepContent, currentStepKey:", currentStepKey);
    switch (currentStepKey) {
      case STEP_KEYS.LOCALIZACAO:
        return (
          <StepContent key="localizacao">
            <div className="space-y-6">
              <StepLocalizacao
                estado={locEstado} cidade={locCidade} tipoTelhado={locTipoTelhado}
                distribuidoraId={locDistribuidoraId}
                onEstadoChange={(v) => { setLocEstado(v); setCliente(c => ({ ...c, estado: v })); }}
                onCidadeChange={(v) => { setLocCidade(v); setCliente(c => ({ ...c, cidade: v })); }}
                onTipoTelhadoChange={setLocTipoTelhado}
                onDistribuidoraChange={(id, nome) => { setLocDistribuidoraId(id); setLocDistribuidoraNome(nome); }}
                onIrradiacaoChange={setLocIrradiacao}
                onMapSnapshotsChange={setMapSnapshots}
                clienteData={cliente}
                projectAddress={projectAddress}
                onProjectAddressChange={setProjectAddress}
              />
              {/* Cliente inline */}
              <div className="border-t border-border/50 pt-4">
                <StepCliente
                  selectedLead={selectedLead}
                  onSelectLead={handleSelectLead}
                  onClearLead={() => setSelectedLead(null)}
                  cliente={cliente}
                  onClienteChange={setCliente}
                  fromProject={!!projectContext}
                />
              </div>
            </div>
          </StepContent>
        );

      case STEP_KEYS.UCS:
        return (
          <StepContent key="ucs">
            <StepConsumptionIntelligence
              ucs={ucs} onUcsChange={handleUcsChange}
              potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp}
              preDimensionamento={preDimensionamento}
              onPreDimensionamentoChange={setPreDimensionamento}
            />
          </StepContent>
        );

      case STEP_KEYS.CAMPOS_PRE:
        return (
          <StepContent key="campos_pre">
            <StepCamposCustomizados values={customFieldValues} onValuesChange={setCustomFieldValues} />
          </StepContent>
        );

      case STEP_KEYS.KIT:
        return (
          <StepContent key="kit">
            <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} otimizadores={otimizadores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} preDimensionamento={preDimensionamento} onPreDimensionamentoChange={setPreDimensionamento} consumoTotal={consumoTotal} />
          </StepContent>
        );

      case STEP_KEYS.ADICIONAIS:
        return (
          <StepContent key="adicionais">
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
          </StepContent>
        );

      case STEP_KEYS.SERVICOS:
        return (
          <StepContent key="servicos">
            <StepServicos servicos={servicos} onServicosChange={setServicos} kitItens={itens} potenciaKwp={potenciaKwp} />
          </StepContent>
        );

      case STEP_KEYS.VENDA:
        return (
          <StepContent key="venda">
            <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} />
          </StepContent>
        );

      case STEP_KEYS.PAGAMENTO:
        return (
          <StepContent key="pagamento">
            <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} ucs={ucs} premissas={premissas} potenciaKwp={potenciaKwp} irradiacao={locIrradiacao} />
          </StepContent>
        );

      case STEP_KEYS.PROPOSTA:
        return (
          <StepContent key="proposta">
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
          </StepContent>
        );

      default:
        return null;
    }
  };

  // ─── Render
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Sticky Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-border/60 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-bold">Nova Proposta</h1>
          {selectedLead && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              {selectedLead.nome}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {potenciaKwp > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Potência</span>
              <span className="font-bold text-foreground">{potenciaKwp.toFixed(2)} kWp</span>
            </div>
          )}
          {consumoTotal > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5 text-secondary" />
              <span className="hidden sm:inline">Consumo</span>
              <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh</span>
            </div>
          )}
          {precoFinal > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-success" />
              <span className="font-bold text-foreground">{formatBRL(precoFinal)}</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full">
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

      {/* ── Pipeline stepper — animated */}
      <div className="relative overflow-x-auto shrink-0 border-b-2 border-secondary/10 bg-gradient-to-b from-card to-muted/20">
        {/* Progress track — blue for done, orange tip */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-secondary to-primary rounded-r-full shadow-sm shadow-secondary/30"
            initial={{ width: "0%" }}
            animate={{ width: `${((step) / (activeSteps.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
        <div className="flex items-center px-2 sm:px-4 py-3 gap-0">
          {activeSteps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.key} className="flex items-center flex-shrink-0">
                <motion.button
                  onClick={() => { if (isDone) goToStep(i); }}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-colors whitespace-nowrap border",
                    isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-primary",
                    isDone && "bg-secondary/10 text-secondary border-secondary/20 cursor-pointer hover:bg-secondary/20 hover:border-secondary/40",
                    !isActive && !isDone && "text-muted-foreground border-transparent cursor-default",
                  )}
                  initial={false}
                  animate={{ scale: isActive ? 1.05 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  whileHover={isDone ? { scale: 1.05 } : undefined}
                >
                  <span className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full text-[10px] shrink-0 transition-colors",
                    isActive && "bg-primary-foreground/25",
                    isDone && "bg-secondary/20 text-secondary",
                    !isActive && !isDone && "bg-muted",
                  )}>
                    {isDone ? (
                      <motion.span
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      >
                        <Check className="h-3 w-3" />
                      </motion.span>
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                  </span>
                  <span className="hidden sm:block">{s.label}</span>
                  {/* Active pulse — orange */}
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-xl border-2 border-primary/50"
                      initial={{ opacity: 1, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.12 }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </motion.button>
                {/* Arrow connector */}
                {i < activeSteps.length - 1 && (
                  <div className="flex items-center mx-0.5 sm:mx-1">
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      isDone ? "text-secondary" : "text-muted-foreground/30",
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Body: Content only */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6">
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </div>
        {!result && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-card sticky bottom-0">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1 h-8 text-xs">
              <ChevronLeft className="h-3 w-3" /> Voltar
            </Button>
            {!isLastStep && (
              <Button size="sm" onClick={goNext} disabled={!canCurrentStep} className="gap-1 h-8 text-xs">
                Próximo <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
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
        onConfirm={handlePosDialogConfirm}
      />
    </div>
  );
}
