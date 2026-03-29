import { useState, useMemo, useCallback } from "react";
import { Copy, Search, X, Database, ChevronRight, Loader2, Plus, Edit2, Trash2, ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, FileText, PenLine, CreditCard, List } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import { useVariaveisCustom, useSalvarVariavelCustom, useDeletarVariavelCustom, type VariavelCustom } from "@/hooks/useVariaveisCustom";
import { AuditTabContent } from "./AuditTabContent";

/* ── Tiny copy button ───────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
          onClick={() => {
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

/* ── Category icons — complete for all VariableCategory ── */
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

/* ── Adapter: VariavelCustom → DbCustomVar shape used by AuditTabContent ── */
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
  return {
    id: v.id,
    nome: v.nome,
    label: v.label,
    expressao: v.expressao,
    tipo_resultado: v.tipo_resultado,
    categoria: v.categoria,
    precisao: v.ordem, // legacy field mapping
    ativo: v.ativo,
  };
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

type ActiveView = VariableCategory | "todas" | "auditoria";

export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ActiveView>("todas");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVar, setEditingVar] = useState<VariavelCustom | null>(null);
  const [form, setForm] = useState({ nome: "vc_", label: "", expressao: "", precisao: 2 });
  const [sortCol, setSortCol] = useState<string>("label");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // §16 / RB-04: queries only in hooks
  const { data: customVarsRaw = [], isLoading: loadingCustom, refetch: refetchCustom } = useVariaveisCustom();
  const salvarMutation = useSalvarVariavelCustom();
  const deletarMutation = useDeletarVariavelCustom();

  // Adapter for AuditTabContent compatibility
  const dbCustomVars = useMemo(() => customVarsRaw.map(toDbCustomVar), [customVarsRaw]);

  const toggleSort = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol]);

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
      await deletarMutation.mutateAsync(deleteTarget);
      toast.success("Variável excluída");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
    setDeleteTarget(null);
  };

  // Static catalog items for current category (includes "todas" view)
  const filtered = useMemo(() => {
    let items = activeCategory === "todas"
      ? [...VARIABLES_CATALOG]
      : VARIABLES_CATALOG.filter((v) => v.category === activeCategory);
    if (search.trim()) {
      const q = normalize(search);
      items = items.filter(
        (v) =>
          normalize(v.label).includes(q) ||
          normalize(v.description).includes(q) ||
          normalize(v.canonicalKey).includes(q) ||
          normalize(v.legacyKey).includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const aVal = sortCol === "label" ? a.label : sortCol === "legacyKey" ? a.legacyKey : sortCol === "canonicalKey" ? a.canonicalKey : sortCol === "unit" ? (a.unit || "") : a.label;
      const bVal = sortCol === "label" ? b.label : sortCol === "legacyKey" ? b.legacyKey : sortCol === "canonicalKey" ? b.canonicalKey : sortCol === "unit" ? (b.unit || "") : b.label;
      return dir * aVal.localeCompare(bVal, "pt-BR");
    });
  }, [search, activeCategory, sortCol, sortDir]);

  const totalCount = useMemo(() => {
    if (activeCategory === "todas") return VARIABLES_CATALOG.length;
    if (activeCategory === "customizada") return dbCustomVars.length;
    if (activeCategory === "auditoria") return 0;
    return VARIABLES_CATALOG.filter((v) => v.category === activeCategory).length;
  }, [activeCategory, dbCustomVars]);

  const currentCount = activeCategory === "customizada"
    ? dbCustomVars.filter((v) => {
        if (!search.trim()) return true;
        const q = normalize(search);
        return normalize(v.label).includes(q) || normalize(v.nome).includes(q) || normalize(v.expressao).includes(q);
      }).length
    : filtered.length;

  const isStandardCatalogView = activeCategory !== "auditoria" && activeCategory !== "customizada";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Database className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Catálogo de variáveis</h1>
            <p className="text-[11px] text-muted-foreground">
              Use <code className="text-primary font-semibold bg-primary/8 px-1 py-0.5 rounded text-[10px]">{"{{grupo.campo}}"}</code> ou{" "}
              <code className="text-muted-foreground font-medium bg-muted px-1 py-0.5 rounded text-[10px]">{"[campo]"}</code>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground shrink-0">
          {currentCount}/{totalCount}
        </Badge>
      </div>

      {/* Card container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Category tabs — auto-wrap responsivo */}
        <div className="border-b border-border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* "Todas" filter — always first */}
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
              <span className={cn("text-[9px] font-mono tabular-nums ml-0.5 min-w-[1.2rem] text-center", activeCategory === "todas" ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                {VARIABLES_CATALOG.length}
              </span>
            </Button>

            {CATEGORY_ORDER.map((cat) => {
              const isActive = activeCategory === cat;
              const count = cat === "customizada"
                ? dbCustomVars.length
                : VARIABLES_CATALOG.filter((v) => v.category === cat).length;
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
                  <span className={cn("text-[9px] font-mono tabular-nums ml-0.5 min-w-[1.2rem] text-center", isActive ? "text-primary-foreground/70" : "text-muted-foreground/40")}>
                    {count}
                  </span>
                </Button>
              );
            })}
            {/* Audit tab */}
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

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Buscar variável..."
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
        </div>

        {/* Content */}
        {activeCategory === "auditoria" ? (
          <AuditTabContent
            dbCustomVars={dbCustomVars}
            loadingCustom={loadingCustom}
            onRefresh={() => refetchCustom()}
            onRequestCreateVariable={(suggested) => {
              setEditingVar(null);
              const tableCategoria: Record<string, string> = {
                clientes: "cliente",
                deals: "comercial",
                projetos: "comercial",
                propostas_nativas: "comercial",
                proposta_versoes: "financeiro",
                simulacoes: "calculo",
                consultores: "comercial",
                concessionarias: "tarifa",
              };
              const categoria = tableCategoria[suggested.table] || "geral";
              const colType = suggested.colType || "string";
              let expressao = `return snapshot?.${suggested.table}?.${suggested.column} ?? "-";`;
              if (colType === "number") {
                expressao = `// Tipo: number\nconst val = snapshot?.${suggested.table}?.${suggested.column};\nreturn typeof val === "number" ? val : 0;`;
              } else if (colType === "date") {
                expressao = `// Tipo: date — formato DD/MM/YYYY\nconst val = snapshot?.${suggested.table}?.${suggested.column};\nif (!val) return "-";\nconst d = new Date(val);\nreturn d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });`;
              } else if (colType === "boolean") {
                expressao = `// Tipo: boolean\nreturn snapshot?.${suggested.table}?.${suggested.column} ? "Sim" : "Não";`;
              }
              setForm({
                nome: `vc_${suggested.nome}`,
                label: suggested.label,
                expressao,
                precisao: colType === "number" ? 2 : 0,
              });
              setModalOpen(true);
            }}
          />
        ) : activeCategory === "customizada" ? (
          <div>
            {/* Header with Add button */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10">
              <span className="text-xs text-muted-foreground font-medium">
                {dbCustomVars.length} variável(is) customizada(s)
              </span>
              <Button size="sm" onClick={openNewModal} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Nova Variável
              </Button>
            </div>

            {loadingCustom ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Carregando...</span>
              </div>
            ) : dbCustomVars.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-xs">Nenhuma variável customizada cadastrada.</p>
                <Button variant="default" size="sm" onClick={openNewModal} className="mt-1 text-xs">Criar primeira variável</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-[10px]">Item</TableHead>
                      <TableHead className="text-[10px]">Chave</TableHead>
                      <TableHead className="text-[10px]">Expressão</TableHead>
                      <TableHead className="text-[10px] w-[160px]">Precisão</TableHead>
                      <TableHead className="text-center text-[10px] w-[80px]">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...dbCustomVars]
                      .filter((v) => {
                        if (!search.trim()) return true;
                        const q = normalize(search);
                        return normalize(v.label).includes(q) || normalize(v.nome).includes(q) || normalize(v.expressao).includes(q);
                      })
                      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
                      .map((v) => {
                        const original = customVarsRaw.find(cv => cv.id === v.id);
                        return (
                          <TableRow key={v.id}>
                            <TableCell>
                              <span className="font-medium text-foreground text-[11px]">{v.label}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">[{v.nome}]</code>
                                <CopyButton text={`[${v.nome}]`} />
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="font-mono text-muted-foreground text-[10px] max-w-[350px] truncate block" title={v.expressao}>
                                {v.expressao}
                              </code>
                            </TableCell>
                            <TableCell>
                              <span className="text-[10px] text-muted-foreground">
                                {v.precisao === 0 ? "Nenhuma casa decimal" : `${v.precisao} casa${v.precisao > 1 ? "s" : ""} decimal${v.precisao > 1 ? "is" : ""}`}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => original && openEditModal(original)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(v.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Modal de Edição/Criação */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogContent className="w-[90vw] max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">Variável Customizada</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="text-xs text-muted-foreground">
                    Chave: <code className="text-primary font-semibold bg-primary/5 px-1.5 py-0.5 rounded">[{form.nome}]</code>
                  </div>
                  <div>
                    <Label className="text-xs">Título:</Label>
                    <Input
                      value={form.label}
                      onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="Nome da variável"
                      className="h-9 text-sm mt-1"
                    />
                  </div>
                  {!editingVar && (
                    <div>
                      <Label className="text-xs">Chave (vc_*):</Label>
                      <Input
                        value={form.nome}
                        onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="vc_minha_variavel"
                        className="h-9 text-sm font-mono mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Expressão:</Label>
                    <Textarea
                      value={form.expressao}
                      onChange={(e) => setForm((f) => ({ ...f, expressao: e.target.value }))}
                      placeholder="[preco]*(1+0.074)^25"
                      className="min-h-[80px] text-sm font-mono mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Precisão decimal (caso se aplique):</Label>
                    <Select
                      value={String(form.precisao)}
                      onValueChange={(v) => setForm((f) => ({ ...f, precisao: Number(v) }))}
                    >
                      <SelectTrigger className="h-9 text-sm mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRECISAO_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setModalOpen(false)}>Fechar</Button>
                  <Button onClick={handleSaveCustom} disabled={salvarMutation.isPending}>
                    {salvarMutation.isPending ? "Salvando..." : "Cadastrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AlertDialog for delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir variável customizada?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A variável será removida permanentemente do banco de dados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          /* Standard catalog table (for "todas" and individual categories) */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  {[
                    { key: "label", label: "Variável", width: "w-[28%]" },
                    { key: "legacyKey", label: "Chave Legada", width: "w-[22%]" },
                    { key: "canonicalKey", label: "Chave Canônica", width: "w-[28%]" },
                    { key: "unit", label: "Unidade", width: "w-[10%]" },
                    { key: "example", label: "Exemplo", width: "w-[12%]" },
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow
                    key={v.canonicalKey}
                    className={cn(v.notImplemented && "opacity-40")}
                  >
                    <TableCell className="py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <ChevronRight className="h-3 w-3 text-primary/30 shrink-0" />
                            <span className="font-medium text-foreground text-[11px] leading-tight">{v.label}</span>
                            {v.isSeries && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-secondary/40 text-secondary font-mono">série</Badge>
                            )}
                            {v.notImplemented && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-destructive/30 text-destructive font-mono">pendente</Badge>
                            )}
                            {activeCategory === "todas" && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-border text-muted-foreground font-mono">
                                {CATEGORY_ICONS[v.category]} {CATEGORY_LABELS[v.category]}
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] text-xs">
                          <p className="font-medium mb-0.5">{v.label}</p>
                          <p className="text-muted-foreground">{v.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">{v.legacyKey}</code>
                        <CopyButton text={v.legacyKey} />
                      </div>
                    </TableCell>

                    <TableCell className="py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">{v.canonicalKey}</code>
                        <CopyButton text={v.canonicalKey} />
                      </div>
                    </TableCell>

                    <TableCell className="py-2 text-center">
                      <span className="text-[10px] text-muted-foreground font-mono">{v.unit || "—"}</span>
                    </TableCell>

                    <TableCell className="py-2 text-right">
                      <span className="text-[10px] text-foreground/60 font-mono tabular-nums">{v.example}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto opacity-15 mb-2" />
                <p className="text-xs font-medium">Nenhuma variável encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
