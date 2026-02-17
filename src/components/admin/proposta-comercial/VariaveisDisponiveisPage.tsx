import { useState, useMemo } from "react";
import { Copy, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 opacity-40 hover:opacity-100 transition-opacity"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success(`Copiado: ${text}`);
      }}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

export function VariaveisDisponiveisPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<VariableCategory | "all" | "customizada">("all");

  const filtered = useMemo(() => {
    let items = VARIABLES_CATALOG;
    if (activeCategory !== "all" && activeCategory !== "customizada") {
      items = items.filter((v) => v.category === activeCategory);
    }
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

  const grouped = useMemo(() => {
    const map = new Map<VariableCategory, CatalogVariable[]>();
    filtered.forEach((v) => {
      const list = map.get(v.category) || [];
      list.push(v);
      map.set(v.category, list);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-lg font-bold text-foreground">Catálogo de Variáveis</h1>
        <p className="text-xs text-muted-foreground">
          Use <code className="text-primary bg-primary/10 px-1 rounded text-[11px]">{"{{grupo.campo}}"}</code> (canônico) ou{" "}
          <code className="text-muted-foreground bg-muted px-1 rounded text-[11px]">{"[campo]"}</code> (legado) nos templates.
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
        {/* Search + Tabs row */}
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="w-full overflow-x-auto">
            <TabsList className="h-auto flex-wrap bg-transparent gap-0 p-0 border-b border-border rounded-none">
              <TabsTrigger value="all" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Entrada de Dados
              </TabsTrigger>
              {CATEGORY_ORDER.filter((c) => c !== "customizada" && c !== "entrada").map((cat) => (
                <TabsTrigger key={cat} value={cat} className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  {CATEGORY_LABELS[cat]}
                </TabsTrigger>
              ))}
              <TabsTrigger value="customizada" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Customizadas
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Customizadas tab content */}
        <TabsContent value="customizada" className="mt-4">
          <VariaveisCustomManager />
        </TabsContent>

        {/* All other tabs show the catalog table */}
        {["all", ...CATEGORY_ORDER.filter((c) => c !== "customizada" && c !== "entrada")].map((tabVal) => (
          <TabsContent key={tabVal} value={tabVal} className="mt-4">
            {Array.from(grouped.entries())
              .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
              .map(([cat, vars]) => (
                <div key={cat} className="mb-8">
                  {activeCategory === "all" && (
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {CATEGORY_LABELS[cat]}
                    </h3>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Item</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Aplica-se</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Chave</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Canônica</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Unidade</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Exemplo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vars.map((v, idx) => (
                          <tr
                            key={v.canonicalKey}
                            className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${v.notImplemented ? "opacity-40" : ""}`}
                          >
                            <td className="px-3 py-2.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-medium text-primary hover:underline cursor-help inline-flex items-center gap-1.5">
                                    {v.label}
                                    {v.isSeries && (
                                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-normal">
                                        série
                                      </Badge>
                                    )}
                                    {v.notImplemented && (
                                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-normal border-warning/40 text-warning">
                                        pendente
                                      </Badge>
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  {v.description}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {v.appliesTo === "todos" ? "BT e MT" : v.appliesTo}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-muted-foreground text-[11px]">
                                  {v.legacyKey}
                                </code>
                                <CopyButton text={v.legacyKey} />
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-primary/70 text-[11px]">
                                  {v.canonicalKey}
                                </code>
                                <CopyButton text={v.canonicalKey} />
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {v.unit || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                              {v.example}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto opacity-20 mb-2" />
                <p className="text-sm">Nenhuma variável encontrada.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
