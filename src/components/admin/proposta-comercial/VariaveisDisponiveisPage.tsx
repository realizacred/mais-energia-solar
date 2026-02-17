import { useState, useMemo } from "react";
import { Copy, Search, Filter, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CatalogVariable,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import { VariaveisCustomManager } from "@/components/admin/propostas-nativas/VariaveisCustomManager";

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">Catálogo de Variáveis</h1>
        <p className="text-sm text-muted-foreground">
          Fonte única de verdade para templates DOCX, WEB e E-mail. Use o formato canônico{" "}
          <code className="text-primary bg-primary/10 px-1 rounded">{"{{grupo.campo}}"}</code> ou legado{" "}
          <code className="text-primary bg-primary/10 px-1 rounded">{"[campo]"}</code>.
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar variáveis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="w-full overflow-x-auto">
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="all" className="text-xs">
                Todas ({VARIABLES_CATALOG.length})
              </TabsTrigger>
              {CATEGORY_ORDER.filter((c) => c !== "customizada").map((cat) => {
                const count = VARIABLES_CATALOG.filter((v) => v.category === cat).length;
                return (
                  <TabsTrigger key={cat} value={cat} className="text-xs">
                    {CATEGORY_LABELS[cat]} ({count})
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="customizada" className="text-xs">
                Customizadas
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Customizadas tab content */}
        <TabsContent value="customizada">
          <VariaveisCustomManager />
        </TabsContent>

        {/* All other tabs show the catalog table */}
        {["all", ...CATEGORY_ORDER.filter((c) => c !== "customizada")].map((tabVal) => (
          <TabsContent key={tabVal} value={tabVal}>
            {Array.from(grouped.entries())
              .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
              .map(([cat, vars]) => (
                <div key={cat} className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[cat]}</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {vars.length}
                    </Badge>
                    {cat === "cdd" && (
                      <Badge variant="outline" className="text-[10px] text-warning border-warning/30 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Não implantado
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/50 border-b">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[180px]">Item</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[80px]">Aplica-se</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Chave Canônica
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Chave Legada
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[60px]">Unidade</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[120px]">Exemplo</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[50px]">Copiar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vars.map((v) => (
                            <tr
                              key={v.canonicalKey}
                              className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${v.notImplemented ? "opacity-50" : ""}`}
                            >
                              <td className="px-3 py-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-medium text-foreground cursor-help flex items-center gap-1">
                                      {v.label}
                                      {v.isSeries && (
                                        <Badge variant="outline" className="text-[8px] px-1">
                                          série
                                        </Badge>
                                      )}
                                      <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs text-xs">
                                    {v.description}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-[9px]">
                                  {v.appliesTo}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <code className="font-mono text-primary/80 text-[11px] bg-primary/5 px-1.5 py-0.5 rounded">
                                  {v.canonicalKey}
                                </code>
                              </td>
                              <td className="px-3 py-2">
                                <code className="font-mono text-muted-foreground text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">
                                  {v.legacyKey}
                                </code>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{v.unit || "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]" title={v.example}>
                                {v.example}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <CopyButton text={v.canonicalKey} label="canônica" />
                                  <CopyButton text={v.legacyKey} label="legada" />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm">Nenhuma variável encontrada.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
