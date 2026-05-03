/**
 * VariablesPanel — Catálogo visual de variáveis disponíveis.
 *
 * Permite ao usuário leigo descobrir quais variáveis pode usar nos
 * blocos de texto livre. Clique copia `{{variavel}}` para clipboard.
 *
 * Reutiliza VARIABLES_CATALOG (SSOT) — não duplica definições.
 */

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search, Copy, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type VariableCategory,
  type CatalogVariable,
} from "@/lib/variablesCatalog";
import { cn } from "@/lib/utils";

// Categorias relevantes para o usuário leigo (esconde técnicas)
const FRIENDLY_CATEGORIES: VariableCategory[] = [
  "cliente",
  "sistema_solar",
  "financeiro",
  "conta_energia",
  "comercial",
  "entrada",
];

export function VariablesPanel() {
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    cliente: true,
    sistema_solar: true,
    financeiro: false,
    conta_energia: false,
    comercial: false,
    entrada: false,
  });

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cats = q ? CATEGORY_ORDER : FRIENDLY_CATEGORIES;
    const map = new Map<VariableCategory, CatalogVariable[]>();
    for (const cat of cats) {
      const items = VARIABLES_CATALOG.filter(v => {
        if (v.category !== cat) return false;
        if (v.notImplemented) return false;
        if (!q) return true;
        return (
          v.label.toLowerCase().includes(q) ||
          v.legacyKey.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
        );
      });
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [search]);

  const toggleCategory = (key: string) => {
    setOpenCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async (variable: CatalogVariable) => {
    const token = `{{${variable.legacyKey}}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopiedKey(variable.legacyKey);
      toast({
        title: "Variável copiada!",
        description: `Cole no editor: ${token}`,
      });
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const handleDragStart = (e: React.DragEvent, variable: CatalogVariable) => {
    const token = `{{${variable.legacyKey}}}`;
    e.dataTransfer.setData("text/plain", token);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar variável..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          💡 Clique para copiar e cole no bloco de texto. Será substituído pelo dado real do cliente.
        </p>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {grouped.size === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma variável encontrada
            </p>
          )}
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <Collapsible
              key={cat}
              open={search.trim() ? true : !!openCategories[cat]}
              onOpenChange={() => !search.trim() && toggleCategory(cat)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                <span>{CATEGORY_LABELS[cat]} ({items.length})</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    openCategories[cat] || search.trim() ? "" : "-rotate-90"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 px-1 pb-2">
                  {items.map(variable => {
                    const isCopied = copiedKey === variable.legacyKey;
                    return (
                      <Tooltip key={variable.legacyKey}>
                        <TooltipTrigger asChild>
                          <button
                            draggable
                            onDragStart={e => handleDragStart(e, variable)}
                            onClick={() => handleCopy(variable)}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all text-left group cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">
                                {variable.label}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate">
                                {`{{${variable.legacyKey}}}`}
                              </div>
                            </div>
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[260px]">
                          <div className="space-y-1">
                            <p className="text-xs font-medium">{variable.label}</p>
                            {variable.description && (
                              <p className="text-[10px] text-muted-foreground">
                                {variable.description}
                              </p>
                            )}
                            {variable.example && (
                              <p className="text-[10px]">
                                <span className="text-muted-foreground">Exemplo:</span>{" "}
                                <span className="font-mono">{variable.example}{variable.unit ? ` ${variable.unit}` : ""}</span>
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
