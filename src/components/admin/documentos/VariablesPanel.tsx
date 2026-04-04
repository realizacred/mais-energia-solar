import { useState } from "react";
import { Copy, Check, Search, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_VARIABLES } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export function VariablesPanel() {
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast.success(`Copiado: ${text}`);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const toggleGroup = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const lowerSearch = search.toLowerCase();
  const filtered = TEMPLATE_VARIABLES.map((g) => ({
    ...g,
    vars: g.vars.filter(
      (v) =>
        v.key.toLowerCase().includes(lowerSearch) ||
        v.desc.toLowerCase().includes(lowerSearch)
    ),
  })).filter((g) => g.vars.length > 0);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar variável..."
          className="h-7 text-xs pl-7"
        />
      </div>
      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-3">
          {filtered.map((g) => {
            const isCollapsed = collapsed[g.group] && !search;
            return (
              <div key={g.group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.group)}
                  className="w-full flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 hover:text-foreground transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  )}
                  {g.group}
                  <span className="text-[10px] font-normal ml-1">({g.vars.length})</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {g.vars.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => copy(v.key)}
                        className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted/60 transition-colors group"
                      >
                        <code className="font-mono text-primary/80 truncate">{v.key}</code>
                        <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                          <span className="hidden group-hover:inline text-[10px] max-w-[100px] truncate">{v.desc}</span>
                          {copiedKey === v.key ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma variável encontrada
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
