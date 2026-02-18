import { useState, useMemo } from "react";
import { Copy, Search, X, Database, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CatalogVariable,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import { VariaveisCustomManager } from "@/components/admin/propostas-nativas/VariaveisCustomManager";

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

export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<VariableCategory | "customizada">("entrada");

  const filtered = useMemo(() => {
    let items = VARIABLES_CATALOG.filter((v) => v.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.canonicalKey.toLowerCase().includes(q) ||
          v.legacyKey.toLowerCase().includes(q)
      );
    }
    return items;
  }, [search, activeCategory]);

  const totalCount = useMemo(() => {
    if (activeCategory === "customizada") return 0;
    return VARIABLES_CATALOG.filter((v) => v.category === activeCategory).length;
  }, [activeCategory]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center">
              <Database className="h-4.5 w-4.5 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Catálogo de Variáveis</h1>
              <p className="text-[11px] text-muted-foreground">
                Use <code className="text-primary font-semibold bg-primary/8 px-1.5 py-0.5 rounded text-[10px]">{"{{grupo.campo}}"}</code> (canônico) ou{" "}
                <code className="text-secondary font-medium bg-secondary/8 px-1.5 py-0.5 rounded text-[10px]">{"[campo]"}</code> (legado)
              </p>
            </div>
          </div>
        </div>
        {activeCategory !== "customizada" && (
          <Badge variant="outline" className="text-[10px] font-mono border-secondary/30 text-secondary shrink-0 mt-2">
            {filtered.length}/{totalCount} variáveis
          </Badge>
        )}
      </div>

      {/* Navigation + Search */}
      <div className="rounded-xl border-2 border-border/60 bg-card overflow-hidden">
        {/* Category Nav */}
        <div className="border-b border-border/60 bg-muted/30">
          <ScrollArea className="w-full">
            <div className="flex items-center gap-0 px-1 py-1">
              {CATEGORY_ORDER.map((cat) => {
                const isActive = activeCategory === cat;
                const count = VARIABLES_CATALOG.filter((v) => v.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-lg whitespace-nowrap transition-all
                      ${isActive
                        ? "bg-card text-foreground shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                      }
                    `}
                  >
                    <span className="text-[13px]">{CATEGORY_ICONS[cat]}</span>
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className={`text-[9px] font-mono ${isActive ? "text-primary" : "text-muted-foreground/60"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-border/40 bg-card">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Buscar variável por nome, chave ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-sm bg-muted/30 border-border/40 focus:bg-card"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {activeCategory === "customizada" ? (
          <div>
            {/* Show catalog vc_* entries first */}
            {filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/5 border-b-2 border-secondary/20">
                      <th className="text-left px-4 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[260px]">Item</th>
                      <th className="text-left px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px]">Chave</th>
                      <th className="text-left px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px]">Canônica</th>
                      <th className="text-center px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[80px]">Unidade</th>
                      <th className="text-right px-4 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[100px]">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v, idx) => (
                      <tr
                        key={v.canonicalKey}
                        className={`border-b border-border/30 transition-colors group ${idx % 2 === 0 ? "bg-card" : "bg-muted/15"} hover:bg-primary/5`}
                      >
                        <td className="px-4 py-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <ChevronRight className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors shrink-0" />
                                <span className="font-semibold text-foreground text-[12px]">{v.label}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[300px] text-xs">
                              <p className="font-medium mb-0.5">{v.label}</p>
                              <p className="text-muted-foreground">{v.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <code className="font-mono text-secondary/80 bg-secondary/5 px-1.5 py-0.5 rounded text-[11px]">{v.legacyKey}</code>
                            <CopyButton text={v.legacyKey} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <code className="font-mono text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded text-[11px]">{v.canonicalKey}</code>
                            <CopyButton text={v.canonicalKey} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-[11px] text-muted-foreground font-mono">{v.unit || "—"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="text-[11px] text-foreground/70 font-mono tabular-nums">{v.example}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Manager for CRUD */}
            <div className="p-4 border-t border-border/40">
              <VariaveisCustomManager />
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/5 border-b-2 border-secondary/20">
                  <th className="text-left px-4 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[260px]">
                    Item
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[90px]">
                    Aplica-se
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px]">
                    Chave legada
                  </th>
                  <th className="text-left px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px]">
                    Chave canônica
                  </th>
                  <th className="text-center px-3 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[80px]">
                    Unidade
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-secondary uppercase tracking-wider text-[10px] w-[100px]">
                    Exemplo
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => (
                  <tr
                    key={v.canonicalKey}
                    className={`
                      border-b border-border/30 transition-colors group
                      ${idx % 2 === 0 ? "bg-card" : "bg-muted/15"}
                      hover:bg-primary/5
                      ${v.notImplemented ? "opacity-50" : ""}
                    `}
                  >
                    {/* ITEM */}
                    <td className="px-4 py-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <ChevronRight className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors shrink-0" />
                            <span className="font-semibold text-foreground text-[12px] leading-tight">
                              {v.label}
                            </span>
                            {v.isSeries && (
                              <Badge className="text-[8px] px-1.5 py-0 h-4 bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/10">
                                série
                              </Badge>
                            )}
                            {v.notImplemented && (
                              <Badge className="text-[8px] px-1.5 py-0 h-4 bg-warning/10 text-warning border-warning/30 hover:bg-warning/10">
                                pendente
                              </Badge>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[300px] text-xs leading-relaxed">
                          <p className="font-medium mb-0.5">{v.label}</p>
                          <p className="text-muted-foreground">{v.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>

                    {/* APLICA-SE */}
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] text-muted-foreground">
                        {v.appliesTo === "todos" ? "Todos" : v.appliesTo === "proposta" ? "Proposta" : v.appliesTo}
                      </span>
                    </td>

                    {/* CHAVE LEGADA */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-secondary/80 bg-secondary/5 px-1.5 py-0.5 rounded text-[11px]">
                          {v.legacyKey}
                        </code>
                        <CopyButton text={v.legacyKey} />
                      </div>
                    </td>

                    {/* CHAVE CANÔNICA */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded text-[11px]">
                          {v.canonicalKey}
                        </code>
                        <CopyButton text={v.canonicalKey} />
                      </div>
                    </td>

                    {/* UNIDADE */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {v.unit || "—"}
                      </span>
                    </td>

                    {/* EXEMPLO */}
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-[11px] text-foreground/70 font-mono tabular-nums">
                        {v.example}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto opacity-15 mb-3" />
                <p className="text-sm font-medium">Nenhuma variável encontrada</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Tente buscar por outro termo</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
