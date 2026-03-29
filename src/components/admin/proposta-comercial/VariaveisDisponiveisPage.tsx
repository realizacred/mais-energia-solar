import { useState, useMemo, useCallback } from "react";
import {
  Copy, Search, X, Database, ChevronRight, Loader2, Plus, Edit2, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, FileText, List, Info,
  Eye, CheckCircle2, AlertTriangle, XCircle, Zap, HelpCircle, Archive,
} from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  type VariableCategory,
  type CatalogVariable,
  type VariableEscopo,
} from "@/lib/variablesCatalog";
import { useVariaveisCustom, useSalvarVariavelCustom, useDeletarVariavelCustom, type VariavelCustom } from "@/hooks/useVariaveisCustom";
import { useVariablesAudit, SOURCE_LABELS, type VariableSource } from "@/hooks/useVariablesAudit";
import { useVariableUsage } from "@/hooks/useVariableUsage";
import { AuditTabContent } from "./AuditTabContent";
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

/* ── DOCX hardcodes removed — now provided by useVariableUsage hook ── */

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
  /** Governance classification for audit */
  governance?: "legado" | "texto" | "input_wizard";
  /** tipo_resultado from DB for custom vars */
  tipoResultado?: string;
}

type StatusFilter = "todas" | "em_uso" | "ok" | "warning" | "error" | "pending" | "nativa" | "custom" | "legado" | "texto";
type ActiveView = VariableCategory | "todas" | "auditoria";

/* ── Semantic explanations for known variables ── */
const SEMANTIC_EXPLANATIONS: Record<string, string> = {
  vc_aumento: "Variável custom avaliada no backend via evaluateExpression(). Expressão real: 100*(([geracao_mensal]/[vc_consumo])-1) — matematicamente equivalente a ((geração - consumo) / consumo) × 100. Usa [vc_consumo] (consumo unificado BT/MT) como base. Se retorna null, [geracao_mensal] ou [vc_consumo] estão ausentes/zero. Semântica: percentual de geração acima do consumo (ex: consumo=500, geração=1000 → aumento=100%). Expressão auditada e confirmada como CORRETA.",
  vc_calculo_seguro: "Valor calculado do seguro da instalação fotovoltaica. Depende de dados do kit (potência, valor) e configuração de seguro do tenant. Retorna nulo quando esses dados não estão disponíveis.",
  vc_garantiaservico: "⚠️ VARIÁVEL DE TEXTO — Retorna texto literal ('2 ano'), não cálculo numérico. tipo_resultado=text no banco. Corretamente classificada. Não tratar como expressão aritmética.",
  vc_string_box_cc: "⚠️ VARIÁVEL DE TEXTO — Retorna texto condicional sobre string box CC baseado em [capo_string_box]. tipo_resultado=text no banco. Corretamente classificada. Não tratar como expressão aritmética.",
  capo_m: "🏚️ PLACEHOLDER LEGADO — Presente em templates DOCX antigos, sem mapeamento no sistema. Aparece como texto cru '[capo_m]' no PDF. Deve ser removido do template DOCX. NÃO criar resolver.",
  capo_seguro: "🔗 INPUT DO WIZARD — Referenciado como dependência em vc_calculo_seguro e vc_incluir_seguro. Deve ser preenchido como campo custom no wizard (campo de proposta). NÃO é um fantasma — é uma entrada do formulário.",
  valor_total: "Valor total final da proposta comercial, já incluindo kit, instalação, serviços, margem e comissão. Formato sem unidade (ex: 42.500,00) — o template DOCX insere 'R$' no texto fixo.",
  potencia_kwp: "Potência total do sistema fotovoltaico em kilowatt-pico. Soma das potências de todos os módulos selecionados.",
  preco_watt: "Preço por watt-pico do sistema (R$/Wp). Calculado como valor_total / (potência_kWp × 1000).",
  geracao_mensal_media: "Geração média mensal estimada do sistema solar, baseada na irradiação local e potência do kit.",
  economia_mensal: "Economia mensal estimada na conta de energia após instalação do sistema solar.",
};

/** Variables classified as legacy/hidden — shown with special governance badge */
const LEGACY_HIDDEN_VARS = new Set(["capo_m"]);

/** Variables that are wizard input fields (not ghosts, but dependencies) */
const WIZARD_INPUT_VARS = new Set(["capo_seguro", "capo_desconto", "capo_string_box"]);

/* ── Source display ── */
function getSourceLabel(source: VariableSource): { label: string; color: string } {
  const info = SOURCE_LABELS[source];
  if (info) return { label: info.label, color: info.color };
  return { label: "Desconhecida", color: "text-muted-foreground" };
}

/* ═══════════════════════════════════════════════════════════════ */
export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ActiveView>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<VariavelCustom | null>(null);
  const [form, setForm] = useState({ nome: "vc_", label: "", expressao: "", precisao: 2 });
  const [sortCol, setSortCol] = useState<string>("label");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<VariavelCustom | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [detailVar, setDetailVar] = useState<EnrichedVariable | null>(null);

  // §16: queries only in hooks
  const { data: customVarsRaw = [], isLoading: loadingCustom, refetch: refetchCustom } = useVariaveisCustom();
  const salvarMutation = useSalvarVariavelCustom();
  const deletarMutation = useDeletarVariavelCustom();
  const dbCustomVars = useMemo(() => customVarsRaw.map(toDbCustomVar), [customVarsRaw]);

  // Audit data for resolver coverage + source info
  const { categoryAudit, resolverCoverage } = useVariablesAudit(dbCustomVars);

  // Dynamic variable usage data (replaces hardcoded DOCX_REAL_VARS / DOCX_BROKEN / DOCX_NULL_VARS)
  const { isInDocx, hasError, hasWarning } = useVariableUsage();

  // Build resolver map from categoryAudit
  const resolverMap = useMemo(() => {
    const map: Record<string, { source: VariableSource; resolver: string }> = {};
    categoryAudit.forEach((cat) => {
      cat.variables.forEach((v) => {
        map[v.key] = { source: v.source, resolver: v.resolver };
      });
    });
    return map;
  }, [categoryAudit]);

  // ── Enriched variables list (catalog + custom merged) ──
  const allVariables = useMemo((): EnrichedVariable[] => {
    const items: EnrichedVariable[] = [];

    // Catalog variables
    VARIABLES_CATALOG.forEach((v) => {
      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      const rm = resolverMap[key];
      const source = rm?.source ?? "unknown";
      const resolver = rm?.resolver ?? "";
      const inDocx = isInDocx(key);
      const docxBroken = hasError(key);
      const docxNull = hasWarning(key);

      let status: EnrichedVariable["status"] = "ok";
      if (v.notImplemented) status = "pending";
      else if (docxBroken) status = "error";
      else if (docxNull) status = "warning";
      else if (source === "unknown" && !inDocx) status = "unused";

      items.push({
        key,
        canonicalKey: v.canonicalKey,
        legacyKey: v.legacyKey,
        label: v.label,
        description: v.description,
        category: v.category,
        unit: v.unit,
        example: v.example,
        isSeries: v.isSeries,
        notImplemented: v.notImplemented,
        isCustom: v.category === "customizada",
        source,
        resolver,
        inDocx,
        docxBroken,
        docxNull,
        status,
      });
    });

    // Custom vars not already in catalog
    customVarsRaw.forEach((cv) => {
      const alreadyInCatalog = items.some((i) => i.key === cv.nome);
      if (!alreadyInCatalog) {
        const inDocx = isInDocx(cv.nome);
        const docxNull = hasWarning(cv.nome);
      const tipoResultado = cv.tipo_resultado || "number";
      const isTextVar = tipoResultado === "text";
        items.push({
          key: cv.nome,
          canonicalKey: `{{customizada.${cv.nome}}}`,
          legacyKey: `[${cv.nome}]`,
          label: cv.label,
          description: cv.descricao || cv.expressao,
          category: "customizada",
          unit: "",
          example: "",
          isCustom: true,
          customId: cv.id,
          expressao: cv.expressao,
          source: "custom_vc",
          resolver: "proposal-generate (evaluateExpression)",
          inDocx,
          docxBroken: false,
          docxNull,
          status: docxNull ? "warning" : "ok",
        governance: isTextVar ? "texto" : undefined,
        tipoResultado,
        });
      } else {
        // Attach customId to existing catalog entry
        const existing = items.find((i) => i.key === cv.nome);
        if (existing) {
          existing.customId = cv.id;
          existing.expressao = cv.expressao;
        }
      }
    });

    return items;
  }, [customVarsRaw, resolverMap]);

  // ── Governance-enriched: mark legacy/wizard input vars ──
  const governanceVariables = useMemo(() => {
    return allVariables.map((v) => {
      if (LEGACY_HIDDEN_VARS.has(v.key)) {
        return { ...v, governance: "legado" as const, status: "unused" as const };
      }
      if (WIZARD_INPUT_VARS.has(v.key)) {
        return { ...v, governance: "input_wizard" as const };
      }
      return v;
    });
  }, [allVariables]);

  // ── Filtered + sorted ──
  const filtered = useMemo(() => {
    let items = [...governanceVariables];

    // Category filter
    if (activeCategory !== "todas" && activeCategory !== "auditoria") {
      items = items.filter((v) => v.category === activeCategory);
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
        case "custom": items = items.filter((v) => v.isCustom); break;
        case "legado": items = items.filter((v) => v.governance === "legado" || v.governance === "input_wizard"); break;
        case "texto": items = items.filter((v) => v.governance === "texto" || v.tipoResultado === "text"); break;
      }
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
    return items.sort((a, b) => {
      const aVal = sortCol === "label" ? a.label : sortCol === "legacyKey" ? a.legacyKey : sortCol === "canonicalKey" ? a.canonicalKey : sortCol === "category" ? CATEGORY_LABELS[a.category] : a.label;
      const bVal = sortCol === "label" ? b.label : sortCol === "legacyKey" ? b.legacyKey : sortCol === "canonicalKey" ? b.canonicalKey : sortCol === "category" ? CATEGORY_LABELS[b.category] : b.label;
      return dir * aVal.localeCompare(bVal, "pt-BR");
    });
  }, [governanceVariables, activeCategory, statusFilter, search, sortCol, sortDir]);

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
    const custom = governanceVariables.filter((v) => v.isCustom).length;
    const legado = governanceVariables.filter((v) => v.governance === "legado" || v.governance === "input_wizard").length;
    const texto = governanceVariables.filter((v) => v.governance === "texto" || v.tipoResultado === "text").length;
    return { total, inUse, ok, warnings, errors, custom, legado, texto };
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
  const StatusBadgeVar = ({ status, inDocx }: { status: EnrichedVariable["status"]; inDocx: boolean }) => {
    const config = {
      ok: { label: "OK", className: "bg-success/15 text-success border-success/20" },
      warning: { label: "Warning", className: "bg-warning/15 text-warning border-warning/20" },
      error: { label: "Erro", className: "bg-destructive/15 text-destructive border-destructive/20" },
      pending: { label: "Pendente", className: "bg-muted text-muted-foreground border-border" },
      unused: { label: "Sem resolver", className: "bg-muted text-muted-foreground border-border" },
    };
    const c = config[status];
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium", c.className)}>
          {c.label}
        </Badge>
        {inDocx && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-info/20 bg-info/10 text-info font-medium">
            Em uso
          </Badge>
        )}
      </div>
    );
  };

  const isAuditView = activeCategory === "auditoria";

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
          <Button size="sm" onClick={openNewModal} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nova Custom
          </Button>
        }
      />

      {/* §27: KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{kpiStats.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total catálogo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{kpiStats.inUse}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Em uso (DOCX)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{kpiStats.ok}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">OK</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{kpiStats.warnings}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Warnings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{kpiStats.errors}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Erros</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main card container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Category tabs */}
        <div className="border-b border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory("todas")}
              className={cn(
                "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                activeCategory === "todas"
                  ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              <span>Todas</span>
              <span className={cn("text-[9px] font-mono tabular-nums ml-0.5", activeCategory === "todas" ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                {allVariables.length}
              </span>
            </Button>

            {CATEGORY_ORDER.map((cat) => {
              const isActive = activeCategory === cat;
              const count = allVariables.filter((v) => v.category === cat).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
                  )}
                >
                  <span className="text-xs">{CATEGORY_ICONS[cat]}</span>
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className={cn("text-[9px] font-mono tabular-nums ml-0.5", isActive ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                    {count}
                  </span>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveCategory("auditoria")}
              className={cn(
                "h-auto px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap",
                activeCategory === "auditoria"
                  ? "bg-warning text-warning-foreground shadow-sm ring-1 ring-warning/20 hover:bg-warning/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent hover:border-border/50"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Auditoria</span>
            </Button>
          </div>
        </div>

        {/* Search + status filters */}
        {!isAuditView && (
          <div className="px-3 py-2.5 border-b border-border flex flex-wrap items-center gap-2">
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
                { key: "pending", label: "Pendente" },
                { key: "nativa", label: "Nativa" },
                { key: "custom", label: "Custom" },
                { key: "legado", label: `Legado (${kpiStats.legado})` },
                { key: "texto", label: `Texto (${kpiStats.texto})` },
              ] as { key: StatusFilter; label: string }[]).map((f) => (
                <Button
                  key={f.key}
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "h-6 px-2 text-[10px] rounded-md",
                    statusFilter === f.key
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
            <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground shrink-0 ml-auto">
              {filtered.length}/{allVariables.length}
            </Badge>
          </div>
        )}

        {/* Content */}
        {isAuditView ? (
          <AuditTabContent
            dbCustomVars={dbCustomVars}
            loadingCustom={loadingCustom}
            onRefresh={() => refetchCustom()}
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
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {[
                    { key: "label", label: "Variável", width: "min-w-[180px]" },
                    { key: "category", label: "Categoria", width: "w-[120px]" },
                    { key: "status", label: "Status", width: "w-[140px]" },
                    { key: "legacyKey", label: "Chave Legada", width: "w-[140px]" },
                    { key: "canonicalKey", label: "Chave Canônica", width: "w-[180px]" },
                    { key: "source", label: "Origem", width: "w-[100px]" },
                    { key: "unit", label: "Un.", width: "w-[60px]" },
                  ].map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn("text-[10px] cursor-pointer hover:text-foreground select-none transition-colors", col.width)}
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
                  <TableHead className="text-[10px] w-[80px] text-center">Ações</TableHead>
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
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3 text-primary/30 shrink-0" />
                        <span className="font-medium text-foreground text-[11px] leading-tight">{v.label}</span>
                        {v.isCustom && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-primary/30 text-primary font-mono">custom</Badge>
                        )}
                        {v.isSeries && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-secondary/40 text-secondary font-mono">série</Badge>
                        )}
                        {v.governance === "legado" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-warning/40 bg-warning/10 text-warning font-mono">legado</Badge>
                        )}
                        {v.governance === "input_wizard" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-info/40 bg-info/10 text-info font-mono">input</Badge>
                        )}
                        {v.governance === "texto" && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/40 text-muted-foreground font-mono">texto</Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Categoria */}
                    <TableCell className="py-2">
                      <span className="text-[10px] text-muted-foreground">
                        {CATEGORY_ICONS[v.category]} {CATEGORY_LABELS[v.category]}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2">
                      <StatusBadgeVar status={v.status} inDocx={v.inDocx} />
                    </TableCell>

                    {/* Chave Legada */}
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px]">{v.legacyKey}</code>
                        <CopyButton text={v.legacyKey} />
                      </div>
                    </TableCell>

                    {/* Chave Canônica */}
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[160px]">{v.canonicalKey}</code>
                        <CopyButton text={v.canonicalKey} />
                      </div>
                    </TableCell>

                    {/* Origem */}
                    <TableCell className="py-2">
                      <span className={cn("text-[10px] font-medium", getSourceLabel(v.source).color)}>
                        {getSourceLabel(v.source).label}
                      </span>
                    </TableCell>

                    {/* Unidade */}
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
                {statusFilter !== "todas" && (
                  <Button variant="link" size="sm" onClick={() => setStatusFilter("todas")} className="text-xs mt-1">
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
                {/* Status + Type */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadgeVar status={detailVar.status} inDocx={detailVar.inDocx} />
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-1.5 py-0.5",
                    detailVar.isCustom ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
                  )}>
                    {detailVar.isCustom ? "🧩 Custom" : "⚙️ Nativa"}
                  </Badge>
                  {detailVar.governance === "legado" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-warning/30 bg-warning/10 text-warning">
                      🏚️ Legado
                    </Badge>
                  )}
                  {detailVar.governance === "input_wizard" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-info/30 bg-info/10 text-info">
                      🔗 Input Wizard
                    </Badge>
                  )}
                  {detailVar.governance === "texto" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-muted-foreground/30 text-muted-foreground">
                      📝 Texto (não numérica)
                    </Badge>
                  )}
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</p>
                    <p className="text-xs text-foreground mt-0.5">{CATEGORY_ICONS[detailVar.category]} {CATEGORY_LABELS[detailVar.category]}</p>
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

                {/* Governance warning for legacy vars */}
                {detailVar.governance === "legado" && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Archive className="h-3.5 w-3.5 text-warning" />
                      <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">Variável Legada</p>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">
                      Esta variável é um placeholder legado presente em templates DOCX antigos. Não possui resolver no sistema e aparece como texto cru no PDF.
                      <strong> Ação recomendada:</strong> Remover do template DOCX. Não criar resolver.
                    </p>
                  </div>
                )}

                {/* Not editable warning for native */}
                {!detailVar.isCustom && !detailVar.customId && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[10px] text-muted-foreground">
                      ⚙️ <strong>Variável nativa do sistema</strong> — não pode ser excluída ou editada. Para personalizar o comportamento, crie uma variável custom referenciando esta.
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
                <Label className="text-xs">Expressão:</Label>
                <Textarea value={form.expressao} onChange={(e) => setForm((f) => ({ ...f, expressao: e.target.value }))} placeholder="[preco]*(1+0.074)^25" className="min-h-[80px] text-sm font-mono mt-1" />
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
              {deleteTarget && isInDocx(deleteTarget.nome) && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  <strong>⚠️ Atenção:</strong> Esta variável está em uso em templates DOCX ativos. Excluí-la pode causar placeholders não resolvidos no PDF gerado.
                </div>
              )}
              {deleteTarget && hasWarning(deleteTarget.nome) && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
                  <strong>⚠️ Aviso:</strong> Esta variável já apresenta valor nulo em algumas gerações.
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
    </div>
  );
}
