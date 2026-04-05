import { useState, useMemo, useCallback } from "react";
import {
  Copy, Search, X, Database, ChevronRight, Loader2, Plus, Edit2, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, FileText, List, Info,
  Eye, CheckCircle2, AlertTriangle, XCircle, Zap, HelpCircle, Archive,
  FlaskConical, Sparkles, Activity, HeartPulse, Shield, Layers, RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useVariableHealth, type HealthClassification } from "@/hooks/useVariableHealth";
import { useVariableGovernance, type GovernanceFilter, type GovernanceRecord } from "@/hooks/useVariableGovernance";
import { useVariableCleanup } from "@/hooks/useVariableCleanup";
import { CleanupPanel } from "./CleanupPanel";
import { VariableTester } from "./VariableTester";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DOMAIN_LABELS,
  DOMAIN_ICONS,
  DOMAIN_ORDER,
  NATURE_LABELS,
  VARIABLE_VIEW_LABELS,
  VARIABLE_VIEW_ICONS,
  deriveDomain,
  deriveNature,
  getVariableViews,
  isBuiltinVcKey,
  type VariableCategory,
  type CatalogVariable,
  type VariableEscopo,
  type VariableDomain,
  type VariableNature,
  type VariableView,
} from "@/lib/variablesCatalog";
import { useVariaveisCustom, useSalvarVariavelCustom, useDeletarVariavelCustom, type VariavelCustom } from "@/hooks/useVariaveisCustom";
import { useVariablesAudit, SOURCE_LABELS, type VariableSource } from "@/hooks/useVariablesAudit";
import { useVariableUsage } from "@/hooks/useVariableUsage";
import { useQuickAudit } from "@/hooks/useRealAudit";
import { useDealCustomFields, FIELD_CONTEXT_LABELS, FIELD_CONTEXT_ICONS } from "@/hooks/useDealCustomFields";
import { AuditTabContent } from "./AuditTabContent";
import { FormulaAISuggest } from "./FormulaAISuggest";
import { PageHeader } from "@/components/ui-kit/PageHeader";

/* ── Tiny copy button ───────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(text);
            toast.success(`Copiado: ${text}`);
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">Copiar</TooltipContent>
    </Tooltip>
  );
}

/* ── Category icons ── */
const CATEGORY_ICONS: Record<VariableCategory, string> = {
  entrada: "📥",
  sistema_solar: "☀️",
  financeiro: "💰",
  conta_energia: "⚡",
  comercial: "🏢",
  cliente: "👤",
  contrato: "📄",
  assinatura: "✍️",
  pagamento: "💳",
  tabelas: "📊",
  series: "📈",
  premissas: "⚙️",
  tarifa: "🏷️",
  aneel: "🔄",
  gd: "🌞",
  calculo: "🧮",
  cdd: "🔗",
  customizada: "🧩",
};

/* ── Adapter: VariavelCustom → DbCustomVar ── */
export interface DbCustomVar {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  precisao: number;
  ativo: boolean;
}

function toDbCustomVar(v: VariavelCustom): DbCustomVar {
  return { id: v.id, nome: v.nome, label: v.label, expressao: v.expressao, tipo_resultado: v.tipo_resultado, categoria: v.categoria, precisao: v.ordem, ativo: v.ativo };
}

const PRECISAO_OPTIONS = [
  { value: 0, label: "Nenhuma casa decimal" },
  { value: 1, label: "1 casa decimal" },
  { value: 2, label: "2 casas decimais" },
  { value: 3, label: "3 casas decimais" },
];

function normalize(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/* ── Enriched variable item for unified display ── */
interface EnrichedVariable {
  key: string;
  canonicalKey: string;
  legacyKey: string;
  label: string;
  description: string;
  category: VariableCategory;
  domain: VariableDomain;
  nature: VariableNature;
  views: VariableView[];
  unit: string;
  example: string;
  isSeries?: boolean;
  notImplemented?: boolean;
  isCustom: boolean;
  customId?: string;
  expressao?: string;
  source: VariableSource;
  resolver: string;
  inDocx: boolean;
  docxBroken: boolean;
  docxNull: boolean;
  status: "ok" | "warning" | "error" | "pending" | "unused";
  tipoResultado?: string;
  escopo?: VariableEscopo;
  _dynamicContext?: string;
  healthClassification?: HealthClassification;
  healthScore?: number;
}

type StatusFilter = "todas" | "em_uso" | "ok" | "warning" | "error" | "pending" | "nativa" | "custom" | "documento" | "aspiracional" | "campo_dinamico" | "health_critical" | "health_unstable" | "health_healthy" | "health_unused";
type ActiveView = VariableView | "todas" | "auditoria" | "limpeza";
type DomainFilter = VariableDomain | "todas";

/* ── Semantic explanations for known variables ── */
const SEMANTIC_EXPLANATIONS: Record<string, string> = {
  vc_aumento: "Variável custom avaliada no backend via evaluateExpression(). Expressão real: 100*(([geracao_mensal]/[vc_consumo])-1) — matematicamente equivalente a ((geração - consumo) / consumo) × 100. Usa [vc_consumo] (consumo unificado BT/MT) como base. Se retorna null, [geracao_mensal] ou [vc_consumo] estão ausentes/zero. Semântica: percentual de geração acima do consumo (ex: consumo=500, geração=1000 → aumento=100%). Expressão auditada e confirmada como CORRETA.",
  vc_calculo_seguro: "Valor calculado do seguro da instalação fotovoltaica. Depende de dados do kit (potência, valor) e configuração de seguro do tenant. Retorna nulo quando esses dados não estão disponíveis.",
  vc_garantiaservico: "⚠️ VARIÁVEL DE TEXTO — Retorna texto literal ('2 ano'), não cálculo numérico. tipo_resultado=text no banco. Corretamente classificada. Não tratar como expressão aritmética.",
  vc_string_box_cc: "⚠️ VARIÁVEL DE TEXTO — Retorna texto condicional sobre string box CC baseado em [capo_string_box]. tipo_resultado=text no banco. Corretamente classificada. Não tratar como expressão aritmética.",
  capo_m: "🏚️ PLACEHOLDER LEGADO — Presente em templates DOCX antigos. Resolver adicionado com fallback para snapshot.capo_m / capital_melhoria. Retorna vazio se não definido.",
  capo_seguro: "🔗 INPUT DO WIZARD — Referenciado como dependência em vc_calculo_seguro e vc_incluir_seguro. Resolver adicionado com fallback para snapshot.capo_seguro / capital_seguro.",
  valor_total: "Valor total final da proposta comercial, já incluindo kit, instalação, serviços, margem e comissão. Formato sem unidade (ex: 42.500,00) — o template DOCX insere 'R$' no texto fixo.",
  potencia_kwp: "Potência total do sistema fotovoltaico em kilowatt-pico. Soma das potências de todos os módulos selecionados.",
  preco_watt: "Preço por watt-pico do sistema (R$/Wp). Calculado como valor_total / (potência_kWp × 1000).",
  geracao_mensal_media: "Geração média mensal estimada do sistema solar, baseada na irradiação local e potência do kit.",
  economia_mensal: "Economia mensal estimada na conta de energia após instalação do sistema solar.",
};

/* ── Source display ── */
function getSourceLabel(source: VariableSource): { label: string; color: string } {
  const info = SOURCE_LABELS[source];
  if (info) return { label: info.label, color: info.color };
  return { label: "Não mapeada", color: "text-muted-foreground" };
}

function getGovernanceFallbackSource(record?: GovernanceRecord): VariableSource | null {
  if (!record) return null;

  switch (record.classification) {
    case "CUSTOM_BACKEND":
    case "CUSTOM_IMPL":
      return "custom_vc";
    case "FEATURE_NAO_IMPLEMENTADA":
    case "CDD":
    case "MAPEAVEL":
      return "futura";
    case "FANTASMA_REAL":
      return "error_unmapped";
    default:
      // Implementada / BE-only / passthrough / documento / legado / wizard
      // devem aparecer como fonte válida, não como erro não mapeado.
      return "snapshot";
  }
}

/* ═══════════════════════════════════════════════════════════════ */
export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("negocio");
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<VariavelCustom | null>(null);
  const [form, setForm] = useState({ nome: "vc_", label: "", expressao: "", precisao: 2 });
  const [sortCol, setSortCol] = useState<string>("label");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<VariavelCustom | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [detailVar, setDetailVar] = useState<EnrichedVariable | null>(null);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const [varPickerSearch, setVarPickerSearch] = useState("");
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testVar, setTestVar] = useState("");
  const [govFilter, setGovFilter] = useState<GovernanceFilter>("todas");

  // §16: queries only in hooks
  const { data: customVarsRaw = [], isLoading: loadingCustom, refetch: refetchCustom } = useVariaveisCustom();
  const salvarMutation = useSalvarVariavelCustom();
  const deletarMutation = useDeletarVariavelCustom();
  const dbCustomVars = useMemo(() => customVarsRaw.map(toDbCustomVar), [customVarsRaw]);

  const { categoryAudit, resolverCoverage } = useVariablesAudit(dbCustomVars);
  const { usageMap } = useVariableUsage();
  const { data: quickAudit } = useQuickAudit();
  const { data: dealCustomFields = [] } = useDealCustomFields();
  const { healthMap, summary: healthSummary, hasData: hasHealthData } = useVariableHealth();
  const queryClient = useQueryClient();

  const dynamicFieldKeysList = useMemo(() => dealCustomFields.map(d => d.field_key), [dealCustomFields]);
  const { records: govRecords, summary: govSummary, getRecord: getGovRecord, filterOptions: govFilterOptions, filterRecords: govFilterRecords } = useVariableGovernance(customVarsRaw, dynamicFieldKeysList);
  const { records: cleanupRecords, summary: cleanupSummary } = useVariableCleanup(govRecords, usageMap);

  const resolverMap = useMemo(() => {
    const map: Record<string, { source: VariableSource; resolver: string }> = {};
    categoryAudit.forEach((cat) => {
      cat.variables.forEach((v) => {
        map[v.key] = { source: v.source, resolver: v.resolver };
      });
    });
    return map;
  }, [categoryAudit]);

  const quickAuditMap = useMemo(() => {
    const broken = new Set(quickAudit?.quebradas ?? []);
    const nulls = new Set(quickAudit?.nulas ?? []);
    const found = new Set(quickAudit?.variaveis_encontradas ?? []);
    return { broken, nulls, found, hasAudit: !!quickAudit };
  }, [quickAudit]);

  const filteredPickerVars = useMemo(() => {
    const term = normalize(varPickerSearch);
    return VARIABLES_CATALOG.filter((v) => {
      if (!term) return true;
      return normalize(v.label).includes(term) ||
        normalize(v.legacyKey).includes(term) ||
        normalize(v.canonicalKey).includes(term) ||
        (v.description && normalize(v.description).includes(term));
    });
  }, [varPickerSearch]);

  // ── Context map for deal custom fields ──
  const CONTEXT_TO_DOMAIN: Record<string, VariableDomain> = {
    projeto: "projeto",
    pre_dimensionamento: "sistema_solar",
    pos_dimensionamento: "sistema_solar",
  };

  // ── Enriched variables list (catalog + custom + deal fields merged) ──
  const allVariables = useMemo((): EnrichedVariable[] => {
    const items: EnrichedVariable[] = [];

    // Catalog variables
    VARIABLES_CATALOG.forEach((v) => {
      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      const rm = resolverMap[key];
      const govRecord = getGovRecord(key);
      const govFallbackSource = getGovernanceFallbackSource(govRecord);

      const source = rm?.source && rm.source !== "error_unmapped"
        ? rm.source
        : (govFallbackSource ?? rm?.source ?? "error_unmapped");

      const resolver = rm?.resolver && rm.resolver.trim().length > 0
        ? rm.resolver
        : govRecord
          ? `governance (${govRecord.classification})`
          : "";
      const usageInfo = usageMap.get(key);
      const auditInDocx = quickAuditMap.found.has(key);
      const auditBroken = quickAuditMap.broken.has(key);
      const auditNull = quickAuditMap.nulls.has(key);
      const inDocx = quickAuditMap.hasAudit ? auditInDocx : (usageInfo?.inDocx ?? false);
      const docxBroken = quickAuditMap.hasAudit ? auditBroken : (usageInfo?.isBroken ?? false);
      const docxNull = quickAuditMap.hasAudit ? auditNull : (usageInfo?.isNull ?? false);

      let status: EnrichedVariable["status"] = "ok";
      if (v.notImplemented) status = "pending";
      else if (docxBroken) status = "error";
      else if (docxNull) status = "warning";
      else if ((source === "error_unmapped" || source === "futura") && !inDocx) status = "unused";

      items.push({
        key,
        canonicalKey: v.canonicalKey,
        legacyKey: v.legacyKey,
        label: v.label,
        description: v.description,
        category: v.category,
        domain: deriveDomain(v),
        nature: deriveNature(v),
        views: getVariableViews(v),
        unit: v.unit,
        example: v.example,
        isSeries: v.isSeries,
        notImplemented: v.notImplemented,
        isCustom: v.category === "customizada" && !isBuiltinVcKey(key),
        source,
        resolver,
        inDocx,
        docxBroken,
        docxNull,
        status,
        escopo: v.escopo,
      });
    });

    // Custom vars not already in catalog
    customVarsRaw.forEach((cv) => {
      const alreadyInCatalog = items.some((i) => i.key === cv.nome);
      if (!alreadyInCatalog) {
        const cvUsage = usageMap.get(cv.nome);
        const inDocx = cvUsage?.inDocx ?? false;
        const docxNull = cvUsage?.isNull ?? false;
        const tipoResultado = cv.tipo_resultado || "number";
        items.push({
          key: cv.nome,
          canonicalKey: `{{customizada.${cv.nome}}}`,
          legacyKey: `[${cv.nome}]`,
          label: cv.label,
          description: cv.descricao || cv.expressao,
          category: "customizada",
          domain: "proposta" as VariableDomain,
          nature: "calculada" as VariableNature,
          views: ["negocio", "template", "tecnica"],
          unit: "",
          example: "",
          isCustom: true,
          customId: cv.id,
          expressao: cv.expressao,
          source: "custom_vc" as VariableSource,
          resolver: "proposal-generate (evaluateExpression)",
          inDocx,
          docxBroken: false,
          docxNull,
          status: docxNull ? "warning" : "ok",
          tipoResultado,
        });
      } else {
        const existing = items.find((i) => i.key === cv.nome);
        if (existing) {
          existing.customId = cv.id;
          existing.expressao = cv.expressao;
        }
      }
    });

    // Dynamic deal custom fields → classified as "campo_entidade", NOT "customizada"
    dealCustomFields.forEach((dcf) => {
      const alreadyExists = items.some((i) => i.key === dcf.field_key);
      if (!alreadyExists) {
        const contextLabel = FIELD_CONTEXT_LABELS[dcf.field_context] ?? dcf.field_context;
        const usageInfo = usageMap.get(dcf.field_key);
        const inDocx = usageInfo?.inDocx ?? false;
        const domain = CONTEXT_TO_DOMAIN[dcf.field_context] ?? "proposta";
        items.push({
          key: dcf.field_key,
          canonicalKey: `{{campo_custom.${dcf.field_key}}}`,
          legacyKey: `[${dcf.field_key}]`,
          label: dcf.title,
          description: `Campo dinâmico (${contextLabel}) — tipo: ${dcf.field_type}`,
          category: "customizada" as VariableCategory, // keep for backward compat
          domain: domain as VariableDomain,
          nature: "campo_custom_entidade",
          views: ["negocio", "template", "tecnica"],
          unit: "",
          example: "",
          isCustom: false,
          source: "snapshot" as VariableSource,
          resolver: "snapshot passthrough (customFieldValues)",
          inDocx,
          docxBroken: false,
          docxNull: false,
          status: "ok",
          tipoResultado: dcf.field_type === "number" || dcf.field_type === "currency" ? "number" : "text",
          escopo: undefined,
          _dynamicContext: dcf.field_context,
        });
      }
    });

    return items;
  }, [customVarsRaw, resolverMap, usageMap, dealCustomFields, quickAuditMap, getGovRecord]);

  // ── Health-enriched variables ──
  const governanceVariables = useMemo(() => {
    return allVariables.map((v) => {
      const health = healthMap.get(v.key);
      const enriched = { ...v } as EnrichedVariable;
      if (health && health.totalExecutions > 0) {
        enriched.healthClassification = health.classification;
        enriched.healthScore = health.healthScore;
      }
      return enriched;
    });
  }, [allVariables, healthMap]);

  // ── Domain counts for sidebar ──
  const domainCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    governanceVariables.forEach((v) => {
      // Count per view
      if (activeView === "todas" || activeView === "auditoria" || activeView === "limpeza") {
        counts[v.domain] = (counts[v.domain] || 0) + 1;
      } else {
        // Only count vars that belong to this view
        if (v.views.includes(activeView as VariableView)) {
          counts[v.domain] = (counts[v.domain] || 0) + 1;
        }
      }
    });
    return counts;
  }, [governanceVariables, activeView]);

  // ── Filtered + sorted ──
  const filtered = useMemo(() => {
    let items = [...governanceVariables];

    // View filter (primary)
    if (activeView !== "todas" && activeView !== "auditoria" && activeView !== "limpeza") {
      items = items.filter((v) => v.views.includes(activeView as VariableView));
      
      // Negócio view: exclude FE-only, future, ghost, and mappable vars (no real backend lastro)
      if (activeView === "negocio") {
        const excludedGovClasses = new Set(["PARCIAL_FE_ONLY", "FEATURE_NAO_IMPLEMENTADA", "FANTASMA_REAL", "MAPEAVEL"]);
        items = items.filter((v) => {
          const govRec = getGovRecord(v.key);
          if (!govRec) return true; // no governance record → keep (custom/dynamic)
          return !excludedGovClasses.has(govRec.classification);
        });
      }
    }

    // Domain filter (secondary)
    if (domainFilter !== "todas") {
      items = items.filter((v) => v.domain === domainFilter);
    }

    // Status filter
    if (statusFilter !== "todas") {
      switch (statusFilter) {
        case "em_uso": items = items.filter((v) => v.inDocx); break;
        case "ok": items = items.filter((v) => v.status === "ok"); break;
        case "warning": items = items.filter((v) => v.status === "warning"); break;
        case "error": items = items.filter((v) => v.status === "error"); break;
        case "pending": items = items.filter((v) => v.status === "pending"); break;
        case "nativa": items = items.filter((v) => !v.isCustom); break;
        case "custom": items = items.filter((v) => v.isCustom || v.nature === "calculada"); break;
        case "documento": items = items.filter((v) => v.domain === "documento"); break;
        case "aspiracional": items = items.filter((v) => v.escopo === "aspiracional"); break;
        case "campo_dinamico": items = items.filter((v) => v.nature === "campo_custom_entidade"); break;
        case "health_critical": items = items.filter((v) => v.healthClassification === "critical"); break;
        case "health_unstable": items = items.filter((v) => v.healthClassification === "unstable"); break;
        case "health_healthy": items = items.filter((v) => v.healthClassification === "healthy"); break;
        case "health_unused": items = items.filter((v) => !v.healthClassification || v.healthClassification === "unused"); break;
      }
    }

    // Governance filter
    if (govFilter !== "todas") {
      const matchingRecords = govFilterRecords(govFilter);
      const govKeys = new Set(matchingRecords.map(r => r.key));
      items = items.filter(v => govKeys.has(v.key));
    }

    // Search
    if (search.trim()) {
      const q = normalize(search);
      items = items.filter(
        (v) =>
          normalize(v.label).includes(q) ||
          normalize(v.description).includes(q) ||
          normalize(v.canonicalKey).includes(q) ||
          normalize(v.legacyKey).includes(q) ||
          normalize(v.key).includes(q)
      );
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (v: EnrichedVariable): string => {
      switch (sortCol) {
        case "label": return v.label;
        case "legacyKey": return v.legacyKey;
        case "canonicalKey": return v.canonicalKey;
        case "domain": return DOMAIN_LABELS[v.domain] ?? v.domain;
        case "nature": return NATURE_LABELS[v.nature] ?? v.nature;
        case "status": return v.status;
        case "source": return SOURCE_LABELS[v.source]?.label ?? v.source;
        case "health": return String(v.healthScore ?? -1).padStart(4, "0");
        case "unit": return v.unit;
        default: return v.label;
      }
    };
    return items.sort((a, b) => dir * getVal(a).localeCompare(getVal(b), "pt-BR"));
  }, [governanceVariables, activeView, domainFilter, statusFilter, search, sortCol, sortDir, govFilter, govFilterRecords, getGovRecord]);

  const toggleSort = useCallback((col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }, [sortCol]);

  // ── KPI stats ──
  const kpiStats = useMemo(() => {
    const total = governanceVariables.length;
    const inUse = governanceVariables.filter((v) => v.inDocx).length;
    const ok = governanceVariables.filter((v) => v.status === "ok").length;
    const warnings = governanceVariables.filter((v) => v.status === "warning").length;
    const errors = governanceVariables.filter((v) => v.status === "error").length;
    const custom = governanceVariables.filter((v) => v.isCustom || v.nature === "calculada").length;
    const campoCustEntidade = governanceVariables.filter((v) => v.nature === "campo_custom_entidade").length;
    const documento = governanceVariables.filter((v) => v.domain === "documento").length;
    const healthCritical = governanceVariables.filter((v) => v.healthClassification === "critical").length;
    const healthUnstable = governanceVariables.filter((v) => v.healthClassification === "unstable").length;
    const healthHealthy = governanceVariables.filter((v) => v.healthClassification === "healthy").length;
    return { total, inUse, ok, warnings, errors, custom, campoCustEntidade, documento, healthCritical, healthUnstable, healthHealthy };
  }, [governanceVariables]);

  // ── Custom var handlers ──
  const openNewModal = () => {
    setEditingVar(null);
    setForm({ nome: "vc_", label: "", expressao: "", precisao: 2 });
    setModalOpen(true);
  };

  const openEditModal = (v: VariavelCustom) => {
    setEditingVar(v);
    setForm({ nome: v.nome, label: v.label, expressao: v.expressao, precisao: v.ordem ?? 2 });
    setModalOpen(true);
  };

  const handleSaveCustom = async () => {
    if (!form.nome || !form.label || !form.expressao) {
      toast.error("Preencha Chave, Título e Expressão");
      return;
    }
    if (!form.nome.startsWith("vc_")) {
      toast.error("A chave deve começar com vc_");
      return;
    }
    try {
      await salvarMutation.mutateAsync({
        id: editingVar?.id ?? null,
        nome: form.nome,
        label: form.label,
        expressao: form.expressao,
        ordem: form.precisao,
        tipo_resultado: "number",
        categoria: "geral",
        ativo: true,
      });
      toast.success(editingVar ? "Variável atualizada!" : "Variável cadastrada!");
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletarMutation.mutateAsync(deleteTarget.id);
      toast.success("Variável excluída");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
    setDeleteTarget(null);
  };

  // ── Status badge ──
  const StatusBadgeVar = ({ status, inDocx, govRecord }: { status: EnrichedVariable["status"]; inDocx: boolean; govRecord?: GovernanceRecord }) => {
    if (govRecord) {
      const colorMap: Record<string, string> = {
        success: "bg-success/15 text-success border-success/20",
        info: "bg-info/15 text-info border-info/20",
        warning: "bg-warning/15 text-warning border-warning/20",
        muted: "bg-muted text-muted-foreground border-border",
        destructive: "bg-destructive/15 text-destructive border-destructive/20",
        primary: "bg-primary/15 text-primary border-primary/20",
        secondary: "bg-secondary/15 text-secondary-foreground border-secondary/20",
      };
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium w-fit", colorMap[govRecord.statusColor] ?? colorMap.muted)}>
            {govRecord.statusLabel}
          </Badge>
          {inDocx && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-info/20 bg-info/10 text-info font-medium w-fit">
              Em uso
            </Badge>
          )}
          {govRecord.templateWarning === "block" && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-destructive/20 bg-destructive/10 text-destructive font-medium w-fit">
              🚫
            </Badge>
          )}
        </div>
      );
    }

    const config = {
      ok: { label: "OK", className: "bg-success/15 text-success border-success/20" },
      warning: { label: "Warning", className: "bg-warning/15 text-warning border-warning/20" },
      error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/20" },
      pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
      unused: { label: "Sem dados", className: "bg-muted text-muted-foreground border-border" },
    };
    const c = config[status];
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium w-fit", c.className)}>
          {c.label}
        </Badge>
        {inDocx && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-info/20 bg-info/10 text-info font-medium w-fit">
            Em uso
          </Badge>
        )}
      </div>
    );
  };

  const isAuditView = activeView === "auditoria";
  const isCleanupView = activeView === "limpeza";
  const isContentView = !isAuditView && !isCleanupView;

  if (loadingCustom) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* §26: Header padrão AGENTS */}
      <PageHeader
        icon={Database}
        title="Variáveis do Sistema"
        description="Consulte, filtre e gerencie as variáveis usadas nos templates de proposta e contrato."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["variable"] })} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Recalcular
            </Button>
            <Button size="sm" onClick={openNewModal} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nova Custom
            </Button>
          </div>
        }
      />

      {/* §27: Governance KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total catálogo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.implementada}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Implementadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.parcial_be_only + govSummary.passthrough}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">BE/Passthrough</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.mapeavel + govSummary.parcial_fe_only}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Mapeáveis/FE-only</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.fantasma_real}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Fantasmas reais</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-l-[3px]",
          govSummary.catalogHealth.level === "saudavel" ? "border-l-success" :
          govSummary.catalogHealth.level === "bom" ? "border-l-info" :
          govSummary.catalogHealth.level === "atencao" ? "border-l-warning" : "border-l-destructive"
        )}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              govSummary.catalogHealth.level === "saudavel" ? "bg-success/10" :
              govSummary.catalogHealth.level === "bom" ? "bg-info/10" :
              govSummary.catalogHealth.level === "atencao" ? "bg-warning/10" : "bg-destructive/10"
            )}>
              <HeartPulse className={cn("h-4 w-4",
                govSummary.catalogHealth.level === "saudavel" ? "text-success" :
                govSummary.catalogHealth.level === "bom" ? "text-info" :
                govSummary.catalogHealth.level === "atencao" ? "text-warning" : "text-destructive"
              )} />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{govSummary.catalogHealth.score}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Saúde ({
                  govSummary.catalogHealth.level === "saudavel" ? "Saudável" :
                  govSummary.catalogHealth.level === "bom" ? "Bom" :
                  govSummary.catalogHealth.level === "atencao" ? "Atenção" : "Crítica"
                })
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical health alert */}
      {hasHealthData && kpiStats.healthCritical > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <HeartPulse className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-destructive">
                {kpiStats.healthCritical} variável(is) crítica(s) detectada(s)
              </p>
              <p className="text-[10px] text-muted-foreground">
                Baseado em {healthSummary.totalReportsAnalyzed} auditorias históricas.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
              onClick={() => setStatusFilter("health_critical")}
            >
              Ver críticas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main card container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* VIEW tabs (primary navigation) */}
        <div className="border-b border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* View presets */}
            {(Object.keys(VARIABLE_VIEW_LABELS) as VariableView[]).map((view) => {
              const isActive = activeView === view;
              const count = governanceVariables.filter(v => v.views.includes(view)).length;
              return (
                <Button
                  key={view}
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActiveView(view); setDomainFilter("todas"); }}
                  className={cn(
                    "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
                  )}
                >
                  <span className="text-xs mr-0.5">{VARIABLE_VIEW_ICONS[view]}</span>
                  <span>{VARIABLE_VIEW_LABELS[view]}</span>
                  <span className={cn("text-[9px] font-mono tabular-nums ml-0.5", isActive ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                    {count}
                  </span>
                </Button>
              );
            })}

            {/* All view */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveView("todas"); setDomainFilter("todas"); }}
              className={cn(
                "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                activeView === "todas"
                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              <List className="h-3.5 w-3.5 mr-0.5" />
              <span>Todas</span>
              <span className={cn("text-[9px] font-mono tabular-nums ml-0.5", activeView === "todas" ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                {allVariables.length}
              </span>
            </Button>

            <div className="h-5 w-px bg-border/50 mx-1" />

            {/* Audit + Cleanup */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("auditoria")}
              className={cn(
                "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                activeView === "auditoria"
                  ? "bg-warning text-warning-foreground shadow-sm ring-1 ring-warning/20 hover:bg-warning/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Auditoria</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("limpeza")}
              className={cn(
                "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                activeView === "limpeza"
                  ? "bg-destructive text-destructive-foreground shadow-sm ring-1 ring-destructive/20 hover:bg-destructive/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Limpeza</span>
            </Button>
          </div>
        </div>

        {/* Domain filter + Search + status filters */}
        {isContentView && (
          <div className="px-3 py-2.5 border-b border-border space-y-2">
            {/* Domain chips */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-wider mr-1">Domínio:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDomainFilter("todas")}
                className={cn(
                  "h-6 px-2 text-[10px] rounded-md",
                  domainFilter === "todas"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todos
              </Button>
              {DOMAIN_ORDER.map((dom) => {
                const count = domainCounts[dom] || 0;
                if (count === 0) return null;
                return (
                  <Button
                    key={dom}
                    variant="ghost"
                    size="sm"
                    onClick={() => setDomainFilter(dom)}
                    className={cn(
                      "h-6 px-2 text-[10px] rounded-md",
                      domainFilter === dom
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-xs mr-0.5">{DOMAIN_ICONS[dom]}</span>
                    {DOMAIN_LABELS[dom]}
                    <span className="text-[8px] font-mono ml-0.5 opacity-60">{count}</span>
                  </Button>
                );
              })}
            </div>

            {/* Search + status filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="Buscar nome, chave, descrição..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-muted/20 border-border focus:bg-card"
                />
                {search && (
                  <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearch("")}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {([
                  { key: "todas", label: "Todas" },
                  { key: "em_uso", label: "Em uso" },
                  { key: "ok", label: "OK" },
                  { key: "warning", label: "Warning" },
                  { key: "error", label: "Erro" },
                  { key: "nativa", label: "Nativa" },
                  { key: "custom", label: `Custom (${kpiStats.custom})` },
                  ...(kpiStats.campoCustEntidade > 0 ? [{ key: "campo_dinamico" as StatusFilter, label: `Campos Entidade (${kpiStats.campoCustEntidade})` }] : []),
                  ...(hasHealthData && kpiStats.healthCritical > 0 ? [{ key: "health_critical" as StatusFilter, label: `🔴 Críticas (${kpiStats.healthCritical})` }] : []),
                ] as { key: StatusFilter; label: string }[]).map((f) => (
                  <Button
                    key={f.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStatusFilter(f.key); setGovFilter("todas"); }}
                    className={cn(
                      "h-6 px-2 text-[10px] rounded-md",
                      statusFilter === f.key && govFilter === "todas"
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </Button>
                ))}
                {statusFilter !== "todas" && (
                  <Button variant="ghost" size="sm" onClick={() => setStatusFilter("todas")} className="h-6 px-2 text-[10px] text-destructive">
                    Limpar
                  </Button>
                )}
              </div>

              {/* Governance filters */}
              <div className="flex flex-wrap items-center gap-1 border-t border-border/50 pt-1.5 mt-1 w-full">
                <span className="text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-wider mr-1">Governança:</span>
                {govFilterOptions.map((f) => (
                  <Button
                    key={f.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => { setGovFilter(f.key); if (f.key !== "todas") setStatusFilter("todas"); }}
                    className={cn(
                      "h-6 px-2 text-[10px] rounded-md",
                      govFilter === f.key
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                    <span className="text-[8px] font-mono ml-0.5 opacity-60">{f.count}</span>
                  </Button>
                ))}
                {govFilter !== "todas" && (
                  <Button variant="ghost" size="sm" onClick={() => setGovFilter("todas")} className="h-6 px-2 text-[10px] text-destructive">
                    Limpar
                  </Button>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground shrink-0 ml-auto">
                {filtered.length}/{allVariables.length}
              </Badge>
            </div>
          </div>
        )}

        {/* Content */}
        {isAuditView ? (
          <AuditTabContent
            dbCustomVars={dbCustomVars}
            loadingCustom={loadingCustom}
            govRecords={govRecords}
            govSummary={govSummary}
            onRefresh={async () => {
              await Promise.all([
                refetchCustom(),
                queryClient.invalidateQueries({ queryKey: ["audit-variables"] }),
                queryClient.invalidateQueries({ queryKey: ["generation-audit-reports-latest"] }),
                queryClient.invalidateQueries({ queryKey: ["generation-audit-health"] }),
                queryClient.invalidateQueries({ queryKey: ["variable-audit-reports-history"] }),
              ]);
            }}
            onRequestCreateVariable={(suggested) => {
              setEditingVar(null);
              const tableCategoria: Record<string, string> = {
                clientes: "cliente", deals: "comercial", projetos: "comercial",
                propostas_nativas: "comercial", proposta_versoes: "financeiro",
                simulacoes: "calculo", consultores: "comercial", concessionarias: "tarifa",
              };
              const categoria = tableCategoria[suggested.table] || "geral";
              const colType = suggested.colType || "string";
              let expressao = `return snapshot?.${suggested.table}?.${suggested.column} ?? "-";`;
              if (colType === "number") expressao = `const val = snapshot?.${suggested.table}?.${suggested.column};\nreturn typeof val === "number" ? val : 0;`;
              else if (colType === "date") expressao = `const val = snapshot?.${suggested.table}?.${suggested.column};\nif (!val) return "-";\nconst d = new Date(val);\nreturn d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });`;
              else if (colType === "boolean") expressao = `return snapshot?.${suggested.table}?.${suggested.column} ? "Sim" : "Não";`;
              setForm({ nome: `vc_${suggested.nome}`, label: suggested.label, expressao, precisao: colType === "number" ? 2 : 0 });
              setModalOpen(true);
            }}
          />
        ) : isCleanupView ? (
          <div className="p-4">
            <CleanupPanel records={cleanupRecords} summary={cleanupSummary} />
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {[
                    { key: "label", label: "Variável", width: "min-w-[180px]" },
                    { key: "domain", label: "Domínio", width: "w-[140px]" },
                    { key: "nature", label: "Natureza", width: "w-[120px]" },
                    { key: "status", label: "Status", width: "w-[140px]" },
                    { key: "legacyKey", label: "Chave", width: "w-[130px]" },
                    { key: "source", label: "Origem", width: "w-[100px]" },
                    { key: "health", label: "Saúde", width: "w-[70px]" },
                    { key: "unit", label: "Un.", width: "w-[50px]" },
                  ].map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn("text-[10px] cursor-pointer hover:text-foreground select-none transition-colors whitespace-nowrap font-semibold", col.width)}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="text-[10px] w-[80px] text-center font-semibold whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow
                    key={v.key}
                    className={cn(
                      "hover:bg-muted/30 cursor-pointer transition-colors",
                      v.notImplemented && "opacity-40",
                      v.status === "error" && "bg-destructive/5",
                    )}
                    onClick={() => setDetailVar(v)}
                  >
                    {/* Variável */}
                    <TableCell className="py-2 min-w-[180px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <ChevronRight className="h-3 w-3 text-primary/30 shrink-0" />
                        <span className="font-medium text-foreground text-[11px] leading-tight">{v.label}</span>
                        {v.isCustom && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-primary/30 text-primary font-mono">custom</Badge>
                        )}
                        {v.nature === "campo_custom_entidade" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-info/30 text-info font-mono">campo</Badge>
                        )}
                        {v.nature === "alias_legado" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-warning/40 bg-warning/10 text-warning font-mono">legado</Badge>
                        )}
                        {v.notImplemented && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/40 text-muted-foreground font-mono">futura</Badge>
                        )}
                        {v.isSeries && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-secondary/40 text-secondary font-mono">série</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Domínio */}
                    <TableCell className="py-2">
                      <span className="text-[10px] text-muted-foreground">
                        {DOMAIN_ICONS[v.domain]} {DOMAIN_LABELS[v.domain]}
                      </span>
                    </TableCell>

                    {/* Natureza */}
                    <TableCell className="py-2">
                      <span className="text-[10px] text-muted-foreground">
                        {NATURE_LABELS[v.nature]}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2">
                      <StatusBadgeVar status={v.status} inDocx={v.inDocx} govRecord={getGovRecord(v.key)} />
                    </TableCell>

                    {/* Chave */}
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[110px]">{v.legacyKey}</code>
                        <CopyButton text={v.legacyKey} />
                      </div>
                    </TableCell>

                    {/* Origem */}
                    <TableCell className="py-2">
                      <span className={cn("text-[10px] font-medium", getSourceLabel(v.source).color)}>
                        {getSourceLabel(v.source).label}
                      </span>
                    </TableCell>

                    {/* Saúde */}
                    <TableCell className="py-2 text-center">
                      {v.healthClassification && v.healthClassification !== "unused" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] px-1.5 py-0 h-4 font-medium",
                            v.healthClassification === "healthy" && "bg-success/15 text-success border-success/20",
                            v.healthClassification === "unstable" && "bg-warning/15 text-warning border-warning/20",
                            v.healthClassification === "critical" && "bg-destructive/15 text-destructive border-destructive/20",
                          )}
                        >
                          {v.healthClassification === "healthy" ? "🟢" : v.healthClassification === "unstable" ? "🟡" : "🔴"}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Un. */}
                    <TableCell className="py-2 text-center">
                      <span className="text-[10px] text-muted-foreground font-mono">{v.unit || "—"}</span>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setDetailVar(v)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">Ver detalhes</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-success"
                              onClick={() => {
                                setTestVar(v.key);
                                setTestDialogOpen(true);
                              }}
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">Testar</TooltipContent>
                        </Tooltip>
                        {v.customId && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-warning"
                                  onClick={() => {
                                    const original = customVarsRaw.find(cv => cv.id === v.customId);
                                    if (original) openEditModal(original);
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const original = customVarsRaw.find(cv => cv.id === v.customId);
                                    if (original) setDeleteTarget(original);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">Excluir</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto opacity-15 mb-2" />
                <p className="text-xs font-medium">Nenhuma variável encontrada</p>
                {(statusFilter !== "todas" || domainFilter !== "todas") && (
                  <Button variant="link" size="sm" onClick={() => { setStatusFilter("todas"); setDomainFilter("todas"); }} className="text-xs mt-1">
                    Limpar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Variable Detail Dialog ── */}
      <Dialog open={!!detailVar} onOpenChange={(open) => !open && setDetailVar(null)}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {detailVar?.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Detalhes e explicação da variável
              </DialogDescription>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            {detailVar && (
              <div className="p-5 space-y-5">
                {/* Status + badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadgeVar status={detailVar.status} inDocx={detailVar.inDocx} govRecord={getGovRecord(detailVar.key)} />
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border text-muted-foreground">
                    {DOMAIN_ICONS[detailVar.domain]} {DOMAIN_LABELS[detailVar.domain]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border text-muted-foreground">
                    {NATURE_LABELS[detailVar.nature]}
                  </Badge>
                  {detailVar.tipoResultado && detailVar.isCustom && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border text-muted-foreground font-mono">
                      tipo: {detailVar.tipoResultado}
                    </Badge>
                  )}
                </div>

                {/* Keys */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chave Legada</p>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded text-xs">{detailVar.legacyKey}</code>
                      <CopyButton text={detailVar.legacyKey} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chave Canônica</p>
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-primary bg-primary/5 px-2 py-1 rounded text-xs">{detailVar.canonicalKey}</code>
                      <CopyButton text={detailVar.canonicalKey} />
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Domínio</p>
                    <p className="text-xs text-foreground mt-0.5">{DOMAIN_ICONS[detailVar.domain]} {DOMAIN_LABELS[detailVar.domain]}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Origem</p>
                    <p className={cn("text-xs mt-0.5", getSourceLabel(detailVar.source).color)}>{getSourceLabel(detailVar.source).label}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Unidade</p>
                    <p className="text-xs text-foreground mt-0.5 font-mono">{detailVar.unit || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Exemplo</p>
                    <p className="text-xs text-foreground mt-0.5 font-mono">{detailVar.example || "—"}</p>
                  </div>
                </div>

                {/* Resolver */}
                {detailVar.resolver && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resolver</p>
                    <code className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded block mt-0.5 font-mono">{detailVar.resolver}</code>
                  </div>
                )}

                {/* Expression (custom) */}
                {detailVar.expressao && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expressão</p>
                    <pre className="text-xs text-foreground bg-muted/20 px-3 py-2 rounded-lg mt-0.5 font-mono overflow-x-auto whitespace-pre-wrap">{detailVar.expressao}</pre>
                  </div>
                )}

                {/* Description */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</p>
                  <p className="text-xs text-foreground leading-relaxed mt-0.5">{detailVar.description}</p>
                </div>

                {/* Semantic explanation */}
                {SEMANTIC_EXPLANATIONS[detailVar.key] && (
                  <div className="rounded-lg border border-info/20 bg-info/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-info" />
                      <p className="text-[10px] font-semibold text-info uppercase tracking-wider">Explicação Semântica</p>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{SEMANTIC_EXPLANATIONS[detailVar.key]}</p>
                  </div>
                )}

                {/* Governance details */}
                {(() => {
                  const gr = getGovRecord(detailVar.key);
                  if (!gr) return null;
                  return (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Evidência da Classificação</p>
                        <p className="text-xs text-foreground leading-relaxed">{gr.evidence}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {gr.inFE && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/20 cursor-help">FE ✓</Badge>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">Resolvida pelo Frontend (resolveProposalVariables) — disponível no preview e tester</p>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                          {gr.inBE && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20 cursor-help">BE ✓</Badge>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">Resolvida pelo Backend (flattenSnapshot/resolvers) — disponível na geração do PDF/DOCX final</p>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                          {gr.isCustom && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary border-primary/20 cursor-help">Custom</Badge>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">Variável customizada — calculada via expressão definida pelo usuário (evaluateExpression)</p>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                          {gr.isDocument && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20 cursor-help">Documento</Badge>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">Variável documental — disponível apenas no contexto de contrato, assinatura ou pagamento</p>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                          {gr.isPassthrough && (
                            <TooltipProvider><Tooltip><TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20 cursor-help">Passthrough</Badge>
                            </TooltipTrigger><TooltipContent side="top" className="max-w-[250px]">
                              <p className="text-xs">Resolvida via deepGet do snapshot — séries, tabelas ou premissas passadas diretamente</p>
                            </TooltipContent></Tooltip></TooltipProvider>
                          )}
                        </div>
                      </div>

                      {gr.templateWarning !== "none" && (
                        <div className={cn("rounded-lg border p-3", gr.templateWarning === "block" ? "border-destructive/20 bg-destructive/5" : "border-warning/20 bg-warning/5")}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Shield className={cn("h-3.5 w-3.5", gr.templateWarning === "block" ? "text-destructive" : "text-warning")} />
                            <p className={cn("text-[10px] font-semibold uppercase tracking-wider", gr.templateWarning === "block" ? "text-destructive" : "text-warning")}>
                              {gr.templateWarning === "block" ? "Bloqueada para novos templates" : "Atenção ao usar em templates"}
                            </p>
                          </div>
                          <p className="text-xs text-foreground">
                            {gr.templateWarning === "block"
                              ? "Esta variável NÃO deve ser usada em novos templates — não possui dados disponíveis."
                              : "Esta variável pode não resolver corretamente em todos os cenários. Revise antes de usar."}
                          </p>
                        </div>
                      )}

                      {gr.suggestions.length > 0 && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1.5">Sugestões</p>
                          <ul className="space-y-1">
                            {gr.suggestions.map((s, i) => (
                              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">→</span>
                                <span>{s.message}{s.replacementKey && <code className="text-primary bg-primary/5 px-1 rounded ml-1">[{s.replacementKey}]</code>}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(gr.cleanup.segura_para_ocultar || gr.cleanup.segura_para_limpeza_futura) && (
                        <div className="rounded-lg border border-muted-foreground/20 bg-muted/30 p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prontidão para Limpeza</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {gr.cleanup.segura_para_ocultar && <Badge variant="outline" className="text-[8px]">Segura para ocultar</Badge>}
                            {gr.cleanup.segura_para_substituir_em_template && <Badge variant="outline" className="text-[8px]">Segura para substituir</Badge>}
                            {gr.cleanup.segura_para_alias && <Badge variant="outline" className="text-[8px]">Segura para alias</Badge>}
                            {gr.cleanup.segura_para_limpeza_futura && <Badge variant="outline" className="text-[8px]">Limpeza futura</Badge>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!detailVar.isCustom && !detailVar.customId && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] text-muted-foreground">
                      ⚙️ <strong>Variável nativa do sistema</strong> — não pode ser excluída ou editada.
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            {detailVar?.customId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    const original = customVarsRaw.find(cv => cv.id === detailVar.customId);
                    if (original) { setDeleteTarget(original); setDetailVar(null); }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const original = customVarsRaw.find(cv => cv.id === detailVar.customId);
                    if (original) { openEditModal(original); setDetailVar(null); }
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setDetailVar(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Custom Variable Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingVar ? "Editar Variável" : "Nova Variável Custom"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Variáveis custom usam prefixo vc_ e são avaliadas na geração
              </DialogDescription>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              <div className="text-xs text-muted-foreground">
                Chave: <code className="text-primary font-semibold bg-primary/5 px-1.5 py-0.5 rounded">[{form.nome}]</code>
              </div>
              <div>
                <Label className="text-xs">Título:</Label>
                <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Nome da variável" className="h-9 text-sm mt-1" />
              </div>
              {!editingVar && (
                <div>
                  <Label className="text-xs">Chave (vc_*):</Label>
                  <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="vc_minha_variavel" className="h-9 text-sm font-mono mt-1" />
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Expressão:</Label>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary gap-1" onClick={() => setAiSuggestOpen(true)}>
                    <Sparkles className="h-3 w-3" /> Sugerir com IA
                  </Button>
                </div>
                <Textarea id="expressao-textarea" value={form.expressao} onChange={(e) => setForm((f) => ({ ...f, expressao: e.target.value }))} placeholder="[preco]*(1+0.074)^25" className="min-h-[80px] text-sm font-mono mt-1" />
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setVarPickerOpen((o) => !o)}
                >
                  <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> Inserir variável na expressão</span>
                  <ChevronRight className={cn("h-3 w-3 transition-transform", varPickerOpen && "rotate-90")} />
                </button>
                {varPickerOpen && (
                  <div className="border-t border-border">
                    <div className="p-2">
                      <Input
                        value={varPickerSearch}
                        onChange={(e) => setVarPickerSearch(e.target.value)}
                        placeholder="Buscar variável por nome, descrição..."
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="max-h-[180px] overflow-y-auto px-2 pb-2 space-y-0.5">
                      {filteredPickerVars.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma variável encontrada</p>
                      ) : (
                        filteredPickerVars.slice(0, 50).map((v) => {
                          const key = v.legacyKey.replace(/^\[|\]$/g, "");
                          return (
                            <button
                              key={v.canonicalKey}
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 group"
                              onClick={() => {
                                setForm((f) => ({ ...f, expressao: f.expressao + `[${key}]` }));
                                toast.success(`[${key}] inserido na expressão`);
                              }}
                            >
                              <div className="min-w-0">
                                <span className="font-mono text-primary text-[10px]">[{key}]</span>
                                <span className="text-muted-foreground ml-1.5">{v.label}</span>
                              </div>
                              <Plus className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 shrink-0" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Precisão decimal:</Label>
                <Select value={String(form.precisao)} onValueChange={(v) => setForm((f) => ({ ...f, precisao: Number(v) }))}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRECISAO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCustom} disabled={salvarMutation.isPending}>
              {salvarMutation.isPending ? "Salvando..." : editingVar ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation AlertDialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir variável customizada?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você está prestes a excluir a variável <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">[{deleteTarget?.nome}]</code> ({deleteTarget?.label}).
              </p>
               {deleteTarget && (usageMap.get(deleteTarget.nome)?.inDocx ?? false) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                   <strong>⚠️ Atenção:</strong> Esta variável está em uso em templates DOCX ativos.
                 </div>
               )}
              <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletarMutation.isPending ? "Excluindo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AI Formula Suggest ── */}
      <FormulaAISuggest
        open={aiSuggestOpen}
        onOpenChange={setAiSuggestOpen}
        onAccept={(formula) => setForm((f) => ({ ...f, expressao: formula }))}
      />

      {/* Test variable dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Testar Variável
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Teste a variável contra uma proposta real
              </DialogDescription>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5">
              <VariableTester initialVariable={testVar} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
