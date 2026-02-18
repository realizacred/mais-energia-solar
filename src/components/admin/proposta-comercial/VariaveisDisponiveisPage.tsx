import { useState, useMemo, useEffect } from "react";
import { Copy, Search, X, Database, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import { VariaveisCustomManager } from "@/components/admin/propostas-nativas/VariaveisCustomManager";
import { supabase } from "@/integrations/supabase/client";

/* ── Tiny copy button ───────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(text);
            toast.success(`Copiado: ${text}`);
          }}
        >
          <Copy className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">Copiar</TooltipContent>
    </Tooltip>
  );
}

/* ── Category icons ─────────────────────────────────────── */
const CATEGORY_ICONS: Partial<Record<VariableCategory, string>> = {
  entrada: "📥",
  sistema_solar: "☀️",
  financeiro: "💰",
  conta_energia: "⚡",
  comercial: "🏢",
  cliente: "👤",
  tabelas: "📊",
  series: "📈",
  premissas: "⚙️",
  cdd: "🔗",
  customizada: "🧩",
};

/* ── Custom variable from DB ────────────────────────────── */
interface DbCustomVar {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  ativo: boolean;
}

/* ── Main page component ────────────────────────────────── */
function normalize(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<VariableCategory>("entrada");
  const [dbCustomVars, setDbCustomVars] = useState<DbCustomVar[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Load custom vars from DB when tab is selected
  useEffect(() => {
    if (activeCategory !== "customizada") return;
    setLoadingCustom(true);
    supabase
      .from("proposta_variaveis_custom")
      .select("id, nome, label, expressao, tipo_resultado, categoria, ativo")
      .order("ordem", { ascending: true })
      .then(({ data }) => {
        setDbCustomVars((data as DbCustomVar[]) || []);
        setLoadingCustom(false);
      });
  }, [activeCategory]);

  const filtered = useMemo(() => {
    if (activeCategory === "customizada") return [];
    let items = VARIABLES_CATALOG.filter((v) => v.category === activeCategory);
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
    // Ordenação alfabética por label
    return [...items].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [search, activeCategory]);

  const filteredCustom = useMemo(() => {
    if (activeCategory !== "customizada") return [];
    let items = dbCustomVars;
    if (search.trim()) {
      const q = normalize(search);
      items = items.filter(
        (v) =>
          normalize(v.nome).includes(q) ||
          normalize(v.label).includes(q) ||
          normalize(v.expressao).includes(q)
      );
    }
    // Ordenação alfabética por label
    return [...items].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [search, activeCategory, dbCustomVars]);

  const totalCount = useMemo(() => {
    if (activeCategory === "customizada") return dbCustomVars.length;
    return VARIABLES_CATALOG.filter((v) => v.category === activeCategory).length;
  }, [activeCategory, dbCustomVars]);

  const currentCount = activeCategory === "customizada" ? filteredCustom.length : filtered.length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
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
        {/* Category tabs — flex-wrap, no scroll */}
        <div className="border-b border-border bg-muted/20 px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            {CATEGORY_ORDER.map((cat) => {
              const isActive = activeCategory === cat;
              const count = cat === "customizada"
                ? dbCustomVars.length
                : VARIABLES_CATALOG.filter((v) => v.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`
                    flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-md whitespace-nowrap transition-all
                    ${isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }
                  `}
                >
                  <span className="text-xs">{CATEGORY_ICONS[cat]}</span>
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className={`text-[9px] font-mono ml-0.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground/50"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
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
        {activeCategory === "customizada" ? (
          <div>
            {/* Custom vars from DB */}
            {loadingCustom ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Carregando variáveis...</span>
              </div>
            ) : filteredCustom.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Nome</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Label</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Expressão</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[80px]">Tipo</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[60px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustom.map((v, idx) => (
                      <tr key={v.id} className={`border-b border-border/40 group transition-colors ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"} hover:bg-accent/5`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight className="h-3 w-3 text-primary/30 group-hover:text-primary shrink-0 transition-colors" />
                            <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[11px]">{`{{vc.${v.nome}}}`}</code>
                            <CopyButton text={`{{vc.${v.nome}}}`} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-foreground text-[11px] font-medium">{v.label}</span>
                        </td>
                        <td className="px-3 py-2">
                          <code className="font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded text-[10px] max-w-[200px] truncate block">{v.expressao}</code>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono">{v.tipo_resultado}</Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block h-2 w-2 rounded-full ${v.ativo ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-xs">Nenhuma variável customizada cadastrada</p>
              </div>
            )}
            {/* CRUD Manager */}
            <div className="p-3 border-t border-border">
              <VariaveisCustomManager />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[240px]">Variável</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[80px]">Aplica-se</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Chave legada</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Chave canônica</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[70px]">Unidade</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[90px]">Exemplo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => (
                  <tr
                    key={v.canonicalKey}
                    className={`
                      border-b border-border/40 transition-colors group
                      ${idx % 2 === 0 ? "bg-card" : "bg-muted/10"}
                      hover:bg-accent/5
                      ${v.notImplemented ? "opacity-40" : ""}
                    `}
                  >
                    <td className="px-3 py-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <ChevronRight className="h-3 w-3 text-primary/30 group-hover:text-primary transition-colors shrink-0" />
                            <span className="font-medium text-foreground text-[11px] leading-tight">{v.label}</span>
                            {v.isSeries && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-secondary/40 text-secondary font-mono">série</Badge>
                            )}
                            {v.notImplemented && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-destructive/30 text-destructive font-mono">pendente</Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] text-xs">
                          <p className="font-medium mb-0.5">{v.label}</p>
                          <p className="text-muted-foreground">{v.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    <td className="px-3 py-2">
                      <span className="text-[10px] text-muted-foreground">
                        {v.appliesTo}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">{v.legacyKey}</code>
                        <CopyButton text={v.legacyKey} />
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">{v.canonicalKey}</code>
                        <CopyButton text={v.canonicalKey} />
                      </div>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <span className="text-[10px] text-muted-foreground font-mono">{v.unit || "—"}</span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] text-foreground/60 font-mono tabular-nums">{v.example}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
