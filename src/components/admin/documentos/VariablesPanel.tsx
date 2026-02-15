import { Copy } from "lucide-react";
import { toast } from "sonner";
import { TEMPLATE_VARIABLES } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

export function VariablesPanel() {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copiado: ${text}`);
  };

  return (
    <ScrollArea className="h-[420px] pr-2">
      <div className="space-y-4">
        {TEMPLATE_VARIABLES.map((g) => (
          <div key={g.group}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{g.group}</p>
            <div className="space-y-1">
              {g.vars.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => copy(v.key)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-md text-xs hover:bg-muted/60 transition-colors group"
                >
                  <code className="font-mono text-primary/80">{v.key}</code>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <span className="hidden group-hover:inline">{v.desc}</span>
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
