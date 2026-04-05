import { useState, useMemo, useCallback } from "react";
import {
  Copy, Search, X, Database, ChevronRight, Plus, Edit2, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck,
  Eye, Info, HelpCircle, Zap, FlaskConical, Sparkles, BookOpen,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useVariableHealth, type HealthClassification } from "@/hooks/useVariableHealth";
import { useVariableGovernance, type GovernanceFilter, type GovernanceRecord } from "@/hooks/useVariableGovernance";
import { useVariableCleanup } from "@/hooks/useVariableCleanup";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VARIABLES_CATALOG, DOMAIN_LABELS, DOMAIN_ICONS,
  deriveDomain, deriveNature, getVariableViews, isBuiltinVcKey,
  type VariableCategory, type CatalogVariable, type VariableEscopo,
  type VariableDomain, type VariableNature, type VariableView,
} from "@/lib/variablesCatalog";
import { useVariaveisCustom, useSalvarVariavelCustom, useDeletarVariavelCustom, type VariavelCustom } from "@/hooks/useVariaveisCustom";
import { useVariablesAudit, SOURCE_LABELS, type VariableSource } from "@/hooks/useVariablesAudit";
import { useVariableUsage } from "@/hooks/useVariableUsage";
import { useQuickAudit } from "@/hooks/useRealAudit";
import { useDealCustomFields, FIELD_CONTEXT_LABELS } from "@/hooks/useDealCustomFields";
import { AuditTabContent } from "./AuditTabContent";
import { FormulaAISuggest } from "./FormulaAISuggest";
import { FunctionsReferenceModal } from "./FunctionsReferenceModal";
import { PageHeader } from "@/components/ui-kit/PageHeader";

/* ── Tiny copy button ── */
function CopyButton({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-5 w-5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); toast.success(`Copiado: ${text}`); }}>
          <Copy className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">Copiar</TooltipContent>
    </Tooltip>
  );
}

/* ── Adapter ── */
export interface DbCustomVar {
  id: string; nome: string; label: string; expressao: string;
  tipo_resultado: string; categoria: string; precisao: number; ativo: boolean;
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

/* ── Enriched variable item ── */
interface EnrichedVariable {
  key: string; canonicalKey: string; legacyKey: string; label: string;
  description: string; category: VariableCategory; domain: VariableDomain;
  nature: VariableNature; views: VariableView[]; unit: string; example: string;
  isSeries?: boolean; notImplemented?: boolean; isCustom: boolean; customId?: string;
  expressao?: string; source: VariableSource; resolver: string;
  inDocx: boolean; docxBroken: boolean; docxNull: boolean;
  status: "ok" | "warning" | "error" | "pending" | "unused";
  tipoResultado?: string; escopo?: VariableEscopo; _dynamicContext?: string;
  healthClassification?: HealthClassification; healthScore?: number;
}

/* ── Source display ── */
function getSourceLabel(source: VariableSource): { label: string; color: string } {
  const info = SOURCE_LABELS[source];
  if (info) return { label: info.label, color: info.color };
  return { label: "Não mapeada", color: "text-muted-foreground" };
}

function getGovernanceFallbackSource(record?: GovernanceRecord): VariableSource | null {
  if (!record) return null;
  switch (record.classification) {
    case "CUSTOM_BACKEND": case "CUSTOM_IMPL": return "custom_vc";
    case "FEATURE_NAO_IMPLEMENTADA": case "CDD": case "MAPEAVEL": return "futura";
    case "FANTASMA_REAL": return "error_unmapped";
    default: return "snapshot";
  }
}

/* ── Tab config ── */
type DomainTab = VariableDomain | "todas" | "custom";

const TAB_ORDER: { key: DomainTab; label: string; icon: string }[] = [
  { key: "todas", label: "Todas", icon: "📊" },
  { key: "cliente", label: "Cliente", icon: "👤" },
  { key: "projeto", label: "Projeto", icon: "🏗️" },
  { key: "proposta", label: "Proposta", icon: "📋" },
  { key: "sistema_solar", label: "Sistema Solar", icon: "☀️" },
  { key: "financeiro", label: "Financeiro", icon: "💰" },
  { key: "conta_energia", label: "Conta de Energia", icon: "⚡" },
  { key: "documento", label: "Comercial", icon: "📄" },
  { key: "uc", label: "Concessionária", icon: "🔌" },
  { key: "custom", label: "Custom (vc_*)", icon: "🧩" },
];

/* ── Status badge component ── */
function StatusBadgeVar({ status, inDocx, expressao, govRecord }: {
  status: EnrichedVariable["status"]; inDocx: boolean; expressao?: string; govRecord?: GovernanceRecord;
}) {
  // Determine which badge to show
  let badge: { label: string; className: string };

  if (govRecord) {
    const colorMap: Record<string, string> = {
      success: "bg-success/15 text-success border-success/20",
      info: "bg-info/15 text-info border-info/20",
      warning: "bg-warning/15 text-warning border-warning/20",
      muted: "bg-muted text-muted-foreground border-border",
      destructive: "bg-destructive/15 text-destructive border-destructive/20",
      primary: "bg-primary/15 text-primary border-primary/20",
    };
    badge = { label: govRecord.statusLabel, className: colorMap[govRecord.statusColor] ?? colorMap.muted };
  } else {
    const config: Record<string, { label: string; className: string }> = {
      ok: { label: "✅ Implementada", className: "bg-success/15 text-success border-success/20" },
      warning: { label: "⚠️ Warning", className: "bg-warning/15 text-warning border-warning/20" },
      error: { label: "❌ Erro", className: "bg-destructive/15 text-destructive border-destructive/20" },
      pending: { label: "⏳ Pendente", className: "bg-muted text-muted-foreground border-border" },
      unused: { label: "—", className: "bg-muted text-muted-foreground border-border" },
    };
    badge = config[status] ?? config.unused;
  }

  // Check for empty expression on custom vars
  const hasEmptyExpression = expressao !== undefined && expressao.trim() === "";

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium w-fit", badge.className)}>
        {badge.label}
      </Badge>
      {hasEmptyExpression && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium w-fit bg-warning/15 text-warning border-warning/20">
          ⚠️ Sem fórmula
        </Badge>
      )}
      {inDocx && (
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-info/20 bg-info/10 text-info font-medium w-fit">
          Em uso
        </Badge>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<VariavelCustom | null>(null);
  const [form, setForm] = useState({ nome: "vc_", label: "", expressao: "", precisao: 2 });
  const [sortCol, setSortCol] = useState<string>("label");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<VariavelCustom | null>(null);
  const [detailVar, setDetailVar] = useState<EnrichedVariable | null>(null);
  const [varPickerOpen, setVarPickerOpen] = useState(false);
  const [varPickerSearch, setVarPickerSearch] = useState("");
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [aiSuggestContext, setAiSuggestContext] = useState<{ varName?: string; formula?: string } | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testVar, setTestVar] = useState("");
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [functionsModalOpen, setFunctionsModalOpen] = useState(false);

  // §16: queries only in hooks
  const { data: customVarsRaw = [], isLoading: loadingCustom, refetch: refetchCustom } = useVariaveisCustom();
  const salvarMutation = useSalvarVariavelCustom();
  const deletarMutation = useDeletarVariavelCustom();
  const dbCustomVars = useMemo(() => customVarsRaw.map(toDbCustomVar), [customVarsRaw]);

  const { categoryAudit } = useVariablesAudit(dbCustomVars);
  const { usageMap } = useVariableUsage();
  const { data: quickAudit } = useQuickAudit();
  const { data: dealCustomFields = [] } = useDealCustomFields();
  const { healthMap } = useVariableHealth();
  const queryClient = useQueryClient();

  const dynamicFieldKeysList = useMemo(() => dealCustomFields.map(d => d.field_key), [dealCustomFields]);
  const { records: govRecords, summary: govSummary, getRecord: getGovRecord } = useVariableGovernance(customVarsRaw, dynamicFieldKeysList);
  const { records: cleanupRecords } = useVariableCleanup(govRecords, usageMap);

  const resolverMap = useMemo(() => {
    const map: Record<string, { source: VariableSource; resolver: string }> = {};
    categoryAudit.forEach((cat) => {
      cat.variables.forEach((v) => { map[v.key] = { source: v.source, resolver: v.resolver }; });
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
      return normalize(v.label).includes(term) || normalize(v.legacyKey).includes(term) || normalize(v.canonicalKey).includes(term);
    });
  }, [varPickerSearch]);

  const CONTEXT_TO_DOMAIN: Record<string, VariableDomain> = {
    projeto: "projeto", pre_dimensionamento: "sistema_solar", pos_dimensionamento: "sistema_solar",
  };

  // ── Enriched variables ──
  const allVariables = useMemo((): EnrichedVariable[] => {
    const items: EnrichedVariable[] = [];

    VARIABLES_CATALOG.forEach((v) => {
      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      const rm = resolverMap[key];
      const govRecord = getGovRecord(key);
      const govFallbackSource = getGovernanceFallbackSource(govRecord);
      const source = rm?.source && rm.source !== "error_unmapped" ? rm.source : (govFallbackSource ?? rm?.source ?? "error_unmapped");
      const resolver = rm?.resolver && rm.resolver.trim().length > 0 ? rm.resolver : govRecord ? `governance (${govRecord.classification})` : "";
      const auditInDocx = quickAuditMap.found.has(key);
      const auditBroken = quickAuditMap.broken.has(key);
      const auditNull = quickAuditMap.nulls.has(key);
      const usageInfo = usageMap.get(key);
      const inDocx = quickAuditMap.hasAudit ? auditInDocx : (usageInfo?.inDocx ?? false);
      const docxBroken = quickAuditMap.hasAudit ? auditBroken : (usageInfo?.isBroken ?? false);
      const docxNull = quickAuditMap.hasAudit ? auditNull : (usageInfo?.isNull ?? false);

      let status: EnrichedVariable["status"] = "ok";
      if (v.notImplemented) status = "pending";
      else if (docxBroken) status = "error";
      else if (docxNull) status = "warning";
      else if ((source === "error_unmapped" || source === "futura") && !inDocx) status = "unused";

      items.push({
        key, canonicalKey: v.canonicalKey, legacyKey: v.legacyKey, label: v.label,
        description: v.description, category: v.category, domain: deriveDomain(v),
        nature: deriveNature(v), views: getVariableViews(v), unit: v.unit, example: v.example,
        isSeries: v.isSeries, notImplemented: v.notImplemented,
        isCustom: v.category === "customizada" && !isBuiltinVcKey(key),
        source, resolver, inDocx, docxBroken, docxNull, status, escopo: v.escopo,
      });
    });

    customVarsRaw.forEach((cv) => {
      const alreadyInCatalog = items.some((i) => i.key === cv.nome);
      if (!alreadyInCatalog) {
        const cvUsage = usageMap.get(cv.nome);
        items.push({
          key: cv.nome, canonicalKey: `{{customizada.${cv.nome}}}`, legacyKey: `[${cv.nome}]`,
          label: cv.label, description: cv.descricao || cv.expressao, category: "customizada",
          domain: "proposta" as VariableDomain, nature: "calculada" as VariableNature,
          views: ["negocio", "template", "tecnica"], unit: "", example: "",
          isCustom: true, customId: cv.id, expressao: cv.expressao,
          source: "custom_vc" as VariableSource, resolver: "proposal-generate (evaluateExpression)",
          inDocx: cvUsage?.inDocx ?? false, docxBroken: false, docxNull: cvUsage?.isNull ?? false,
          status: cvUsage?.isNull ? "warning" : "ok", tipoResultado: cv.tipo_resultado || "number",
        });
      } else {
        const existing = items.find((i) => i.key === cv.nome);
        if (existing) { existing.customId = cv.id; existing.expressao = cv.expressao; }
      }
    });

    dealCustomFields.forEach((dcf) => {
      const alreadyExists = items.some((i) => i.key === dcf.field_key);
      if (!alreadyExists) {
        const contextLabel = FIELD_CONTEXT_LABELS[dcf.field_context] ?? dcf.field_context;
        const usageInfo = usageMap.get(dcf.field_key);
        const domain = CONTEXT_TO_DOMAIN[dcf.field_context] ?? "proposta";
        items.push({
          key: dcf.field_key, canonicalKey: `{{campo_custom.${dcf.field_key}}}`, legacyKey: `[${dcf.field_key}]`,
          label: dcf.title, description: `Campo dinâmico (${contextLabel}) — tipo: ${dcf.field_type}`,
          category: "customizada" as VariableCategory, domain: domain as VariableDomain,
          nature: "campo_custom_entidade", views: ["negocio", "template", "tecnica"],
          unit: "", example: "", isCustom: false,
          source: "snapshot" as VariableSource, resolver: "snapshot passthrough (customFieldValues)",
          inDocx: usageInfo?.inDocx ?? false, docxBroken: false, docxNull: false,
          status: "ok", tipoResultado: dcf.field_type === "number" || dcf.field_type === "currency" ? "number" : "text",
          escopo: undefined, _dynamicContext: dcf.field_context,
        });
      }
    });

    return items;
  }, [customVarsRaw, resolverMap, usageMap, dealCustomFields, quickAuditMap, getGovRecord]);

  // Health enrichment
  const governanceVariables = useMemo(() => {
    return allVariables.map((v) => {
      const health = healthMap.get(v.key);
      const enriched = { ...v };
      if (health && health.totalExecutions > 0) {
        enriched.healthClassification = health.classification;
        enriched.healthScore = health.healthScore;
      }
      return enriched;
    });
  }, [allVariables, healthMap]);

  // ── Filter by active tab + search ──
  const getFilteredItems = useCallback((tab: string) => {
    let items = [...governanceVariables];

    // Tab filter
    if (tab === "custom") {
      items = items.filter((v) => v.isCustom || v.customId || v.source === "custom_vc" || v.key.startsWith("vc_"));
    } else if (tab !== "todas") {
      items = items.filter((v) => v.domain === tab);
    }

    // Search
    if (search.trim()) {
      const q = normalize(search);
      items = items.filter((v) =>
        normalize(v.label).includes(q) || normalize(v.key).includes(q) || normalize(v.legacyKey).includes(q) || normalize(v.description).includes(q)
      );
    }

    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (v: EnrichedVariable): string => {
      switch (sortCol) {
        case "label": return v.label;
        case "legacyKey": return v.legacyKey;
        case "expressao": return v.expressao || v.resolver || "";
        case "status": return v.status;
        default: return v.label;
      }
    };
    return items.sort((a, b) => dir * getVal(a).localeCompare(getVal(b), "pt-BR"));
  }, [governanceVariables, search, sortCol, sortDir]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    governanceVariables.forEach((v) => {
      counts["todas"] = (counts["todas"] || 0) + 1;
      counts[v.domain] = (counts[v.domain] || 0) + 1;
      if (v.isCustom || v.customId || v.source === "custom_vc" || v.key.startsWith("vc_")) {
        counts["custom"] = (counts["custom"] || 0) + 1;
      }
    });
    return counts;
  }, [governanceVariables]);

  const toggleSort = useCallback((col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }, [sortCol]);

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
        nome: form.nome, label: form.label, expressao: form.expressao,
        ordem: form.precisao, tipo_resultado: "number", categoria: "geral", ativo: true,
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

  if (loadingCustom) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  const currentItems = getFilteredItems(activeTab);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <PageHeader
          icon={Zap}
          title="Variáveis do Sistema"
          description="Gerencie as variáveis usadas nos templates de proposta e contrato."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setFunctionsModalOpen(true)} className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Funções
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAuditPanel((v) => !v)} className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Auditoria
              </Button>
              <Button size="sm" onClick={openNewModal} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nova Custom
              </Button>
            </div>
          }
        />

        {/* Audit panel */}
        {showAuditPanel && (
          <Card className="border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Auditoria & Diagnóstico</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAuditPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-lg font-bold text-foreground">{govSummary.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total catálogo</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-success/5 border border-success/20">
                  <p className="text-lg font-bold text-success">{govSummary.implementada}</p>
                  <p className="text-[10px] text-muted-foreground">Implementadas</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-lg font-bold text-destructive">{govSummary.fantasma_real}</p>
                  <p className="text-[10px] text-muted-foreground">Fantasmas</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-lg font-bold text-primary">{govSummary.catalogHealth.score}%</p>
                  <p className="text-[10px] text-muted-foreground">Saúde</p>
                </div>
              </div>
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
                  const colType = suggested.colType || "string";
                  let expressao = `return snapshot?.${suggested.table}?.${suggested.column} ?? "-";`;
                  if (colType === "number") expressao = `const val = snapshot?.${suggested.table}?.${suggested.column};\nreturn typeof val === "number" ? val : 0;`;
                  else if (colType === "date") expressao = `const val = snapshot?.${suggested.table}?.${suggested.column};\nif (!val) return "-";\nconst d = new Date(val);\nreturn d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });`;
                  else if (colType === "boolean") expressao = `return snapshot?.${suggested.table}?.${suggested.column} ? "Sim" : "Não";`;
                  setForm({ nome: `vc_${suggested.nome}`, label: suggested.label, expressao, precisao: colType === "number" ? 2 : 0 });
                  setModalOpen(true);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Search bar */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome ou chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-card border-border"
          />
          {search && (
            <Button variant="ghost" size="icon" className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearch("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Tabs by category/domain */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="overflow-x-auto flex-wrap h-auto bg-muted/30 p-1">
            {TAB_ORDER.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="shrink-0 whitespace-nowrap text-xs gap-1 data-[state=active]:bg-card">
                <span>{t.icon}</span> {t.label}
                {tabCounts[t.key] ? (
                  <span className="text-[10px] text-muted-foreground ml-0.5">({tabCounts[t.key]})</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Single content area — filtered by tab */}
          <TabsContent value={activeTab} className="mt-3">
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    {[
                      { key: "label", label: "Nome", width: "min-w-[180px]" },
                      { key: "legacyKey", label: "Chave", width: "w-[140px]" },
                      { key: "expressao", label: "Fórmula / Origem", width: "min-w-[160px]" },
                      { key: "status", label: "Status", width: "w-[130px]" },
                    ].map((col) => (
                      <TableHead
                        key={col.key}
                        className={cn("text-xs cursor-pointer hover:text-foreground select-none transition-colors whitespace-nowrap font-semibold", col.width)}
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
                    <TableHead className="text-xs w-[160px] text-center font-semibold whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((v) => (
                    <TableRow
                      key={v.key}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer transition-colors",
                        v.status === "error" && "bg-destructive/5",
                        v.expressao !== undefined && v.expressao.trim() === "" && "bg-warning/5",
                      )}
                      onClick={() => setDetailVar(v)}
                    >
                      {/* Nome */}
                      <TableCell className="py-2.5 min-w-[180px]">
                        <div>
                          <span className="font-medium text-foreground text-sm">{v.label}</span>
                          {v.domain !== "proposta" && activeTab === "todas" && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{DOMAIN_ICONS[v.domain]} {DOMAIN_LABELS[v.domain]}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Chave */}
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded text-xs truncate max-w-[120px]">{v.legacyKey}</code>
                          <CopyButton text={v.legacyKey} />
                        </div>
                      </TableCell>

                      {/* Fórmula / Origem */}
                      <TableCell className="py-2.5 min-w-[160px]">
                        {v.expressao ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <code className="font-mono text-xs text-muted-foreground truncate block max-w-[200px]">
                                {v.expressao.length > 40 ? v.expressao.slice(0, 40) + "…" : v.expressao}
                              </code>
                            </TooltipTrigger>
                            {v.expressao.length > 40 && (
                              <TooltipContent side="top" className="max-w-[400px]">
                                <pre className="text-xs font-mono whitespace-pre-wrap">{v.expressao}</pre>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        ) : (
                          <span className={cn("text-xs", getSourceLabel(v.source).color)}>
                            {getSourceLabel(v.source).label}
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2.5">
                        <StatusBadgeVar status={v.status} inDocx={v.inDocx} expressao={v.expressao} govRecord={getGovRecord(v.key)} />
                      </TableCell>

                      {/* Ações */}
                      <TableCell className="py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Ver */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setDetailVar(v)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Ver detalhes</TooltipContent>
                          </Tooltip>

                          {/* Testar */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-info"
                                onClick={() => { setTestVar(v.key); setTestDialogOpen(true); }}>
                                <FlaskConical className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Testar</TooltipContent>
                          </Tooltip>

                          {/* IA — highlight if empty expression */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className={cn(
                                  "h-7 w-7",
                                  v.expressao !== undefined && v.expressao.trim() === ""
                                    ? "text-warning hover:text-warning hover:bg-warning/10"
                                    : "text-muted-foreground hover:text-primary"
                                )}
                                onClick={() => {
                                  setAiSuggestContext({ varName: v.label, formula: v.expressao });
                                  setAiSuggestOpen(true);
                                }}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">Sugerir fórmula com IA</TooltipContent>
                          </Tooltip>

                          {/* Editar */}
                          {(v.customId || v.source === "custom_vc") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-warning"
                                  onClick={() => {
                                    const original = customVarsRaw.find(cv => cv.id === v.customId || cv.nome === v.key);
                                    if (original) openEditModal(original);
                                  }}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">Editar</TooltipContent>
                            </Tooltip>
                          )}

                          {/* Excluir */}
                          {(v.customId || v.source === "custom_vc") && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    const original = customVarsRaw.find(cv => cv.id === v.customId || cv.nome === v.key);
                                    if (original) setDeleteTarget(original);
                                  }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-[10px]">Excluir</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {currentItems.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto opacity-15 mb-2" />
                  <p className="text-sm font-medium">Nenhuma variável encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">Ajuste a busca ou mude a aba</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">{currentItems.length} variáveis</p>
          </TabsContent>
        </Tabs>

        {/* ── Variable Detail Dialog ── */}
        <Dialog open={!!detailVar} onOpenChange={(open) => !open && setDetailVar(null)}>
          <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base font-semibold text-foreground">{detailVar?.label}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">Detalhes da variável</DialogDescription>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0">
              {detailVar && (
                <div className="p-5 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadgeVar status={detailVar.status} inDocx={detailVar.inDocx} expressao={detailVar.expressao} govRecord={getGovRecord(detailVar.key)} />
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-border text-muted-foreground">
                      {DOMAIN_ICONS[detailVar.domain]} {DOMAIN_LABELS[detailVar.domain]}
                    </Badge>
                  </div>

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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resolver</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{detailVar.resolver || "—"}</p>
                    </div>
                  </div>

                  {detailVar.expressao && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Expressão</p>
                      <pre className="text-xs text-foreground bg-muted/20 px-3 py-2 rounded-lg mt-0.5 font-mono overflow-x-auto whitespace-pre-wrap">{detailVar.expressao}</pre>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</p>
                    <p className="text-xs text-foreground leading-relaxed mt-0.5">{detailVar.description}</p>
                  </div>

                  {/* Governance details */}
                  {(() => {
                    const gr = getGovRecord(detailVar.key);
                    if (!gr) return null;
                    return (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Evidência</p>
                          <p className="text-xs text-foreground leading-relaxed">{gr.evidence}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {gr.inFE && <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/20">FE ✓</Badge>}
                            {gr.inBE && <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20">BE ✓</Badge>}
                            {gr.isCustom && <Badge variant="outline" className="text-[8px] bg-primary/10 text-primary border-primary/20">Custom</Badge>}
                            {gr.isPassthrough && <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20">Passthrough</Badge>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-between gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
              <div className="flex gap-2">
                {detailVar && (
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                    setTestVar(detailVar.key); setTestDialogOpen(true); setDetailVar(null);
                  }}>
                    <FlaskConical className="h-3.5 w-3.5" /> Testar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {(detailVar?.customId || detailVar?.source === "custom_vc") && (
                  <>
                    <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const original = customVarsRaw.find(cv => cv.id === detailVar!.customId || cv.nome === detailVar!.key);
                        if (original) { setDeleteTarget(original); setDetailVar(null); }
                      }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => {
                        const original = customVarsRaw.find(cv => cv.id === detailVar!.customId || cv.nome === detailVar!.key);
                        if (original) { openEditModal(original); setDetailVar(null); }
                      }}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => setDetailVar(null)}>Fechar</Button>
              </div>
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
                        <Input value={varPickerSearch} onChange={(e) => setVarPickerSearch(e.target.value)} placeholder="Buscar variável..." className="h-7 text-xs" />
                      </div>
                      <div className="max-h-[180px] overflow-y-auto px-2 pb-2 space-y-0.5">
                        {filteredPickerVars.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground text-center py-3">Nenhuma variável encontrada</p>
                        ) : (
                          filteredPickerVars.slice(0, 50).map((v) => {
                            const key = v.legacyKey.replace(/^\[|\]$/g, "");
                            return (
                              <button key={v.canonicalKey} type="button"
                                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 group"
                                onClick={() => { setForm((f) => ({ ...f, expressao: f.expressao + `[${key}]` })); toast.success(`[${key}] inserido`); }}>
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

        {/* ── Delete Confirmation ── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir variável customizada?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>Você está prestes a excluir <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded text-xs">[{deleteTarget?.nome}]</code> ({deleteTarget?.label}).</p>
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
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

        {/* ── Functions Reference Modal ── */}
        <FunctionsReferenceModal open={functionsModalOpen} onOpenChange={setFunctionsModalOpen} />

        {/* ── Test variable dialog ── */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base font-semibold text-foreground">Testar Variável</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">Teste contra uma proposta real</DialogDescription>
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
    </TooltipProvider>
  );
}
