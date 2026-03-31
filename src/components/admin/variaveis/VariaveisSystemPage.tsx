import { useState, useMemo } from "react";
import { Copy, Search, X, Variable, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import { VariaveisAuditPanel } from "./VariaveisAuditPanel";

export function VariaveisSystemPage() {
  const [selectedCategory, setSelectedCategory] = useState<VariableCategory>("entrada");
  const [search, setSearch] = useState("");

  const filteredVars = useMemo(() => {
    const vars = VARIABLES_CATALOG.filter((v) => v.category === selectedCategory);
    if (!search.trim()) return vars;
    const q = search.toLowerCase();
    return vars.filter(
      (v) =>
        v.label.toLowerCase().includes(q) ||
        v.legacyKey.toLowerCase().includes(q) ||
        v.canonicalKey.toLowerCase().includes(q)
    );
  }, [selectedCategory, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of VARIABLES_CATALOG) {
      counts[v.category] = (counts[v.category] || 0) + 1;
    }
    return counts;
  }, []);

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(`Copiado: ${key}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Variable}
        title="Variáveis do Sistema"
        description={`Catálogo completo com ${VARIABLES_CATALOG.length} variáveis disponíveis para templates de proposta e documentos.`}
      />

      <Tabs defaultValue="catalogo">
        <TabsList className="overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="catalogo" className="gap-1.5 shrink-0 whitespace-nowrap">
            <Variable className="w-3.5 h-3.5" />
            Catálogo
          </TabsTrigger>
          <TabsTrigger value="auditoria" className="gap-1.5 shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5" />
            Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="flex h-[calc(100vh-18rem)]">
                {/* Category sidebar */}
                <div className="w-52 shrink-0 border-r border-border p-3 overflow-y-auto">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-2">
                    Categorias
                  </p>
                  <div className="space-y-0.5">
                    {CATEGORY_ORDER.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                          "w-full text-left text-xs px-3 py-2 rounded-lg transition-colors flex items-center justify-between",
                          selectedCategory === cat
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <span className="truncate">{CATEGORY_LABELS[cat]}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] h-4 min-w-[20px] justify-center ml-1 shrink-0",
                            selectedCategory === cat
                              ? "border-primary-foreground/30 text-primary-foreground"
                              : "border-border"
                          )}
                        >
                          {categoryCounts[cat] || 0}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variables table */}
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Search bar */}
                  <div className="shrink-0 p-3 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar variável por nome ou chave..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs pl-8"
                      />
                      {search && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                          onClick={() => setSearch("")}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORY_LABELS[selectedCategory]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {filteredVars.length} variáveis
                      </span>
                    </div>
                  </div>

                  {/* Table */}
                  <ScrollArea className="flex-1 min-h-0">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 z-10 backdrop-blur-sm">
                        <tr className="text-[10px] uppercase text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">Label</th>
                          <th className="text-left py-2 px-3 font-medium">Chave Canônica</th>
                          <th className="text-left py-2 px-3 font-medium">Chave Legada</th>
                          <th className="text-left py-2 px-3 font-medium">Exemplo</th>
                          <th className="w-[60px]" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVars.map((v) => (
                          <tr
                            key={v.canonicalKey}
                            className="border-b border-border/10 hover:bg-muted/20 transition-colors"
                          >
                            <td className="py-2 px-3 text-foreground font-medium">{v.label}</td>
                            <td className="py-2 px-3">
                              <code className="font-mono text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                                {v.canonicalKey}
                              </code>
                            </td>
                            <td className="py-2 px-3">
                              <code className="font-mono text-[10px] text-muted-foreground">
                                {v.legacyKey}
                              </code>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground text-[10px]">
                              {v.example || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => copyKey(v.canonicalKey)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {filteredVars.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground">
                              Nenhuma variável encontrada
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="h-[calc(100vh-18rem)]">
                <VariaveisAuditPanel />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
