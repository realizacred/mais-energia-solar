/**
 * SmTerminalLog — Premium terminal-style log viewer with colored output and copy button.
 */
import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SmTerminalLogProps {
  logs: string[];
  className?: string;
  maxHeight?: string;
}

function colorize(line: string): { text: string; color: string } {
  const lower = line.toLowerCase();
  if (lower.includes("erro") || lower.includes("error") || lower.includes("falha") || lower.includes("fatal")) {
    return { text: line, color: "text-destructive" };
  }
  if (lower.includes("ok") || lower.includes("sucesso") || lower.includes("success") || lower.includes("concluí") || lower.includes("migrada")) {
    return { text: line, color: "text-success" };
  }
  if (lower.includes("lote") || lower.includes("iniciando") || lower.includes("info") || lower.includes("buscando")) {
    return { text: line, color: "text-info" };
  }
  if (lower.includes("aguardando") || lower.includes("retentativa") || lower.includes("warning") || lower.includes("cancelan")) {
    return { text: line, color: "text-warning" };
  }
  return { text: line, color: "text-muted-foreground" };
}

export function SmTerminalLog({ logs, className, maxHeight = "max-h-48" }: SmTerminalLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n")).then(() => {
      toast.success("Logs copiados!");
    }).catch(() => {
      toast.error("Não foi possível copiar.");
    });
  };

  if (logs.length === 0) return null;

  return (
    <div className={cn("rounded-lg overflow-hidden border border-border", className)}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
            <Terminal className="h-3 w-3" />
            migration-logs
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          onClick={handleCopy}
          title="Copiar logs"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className={cn("bg-zinc-950 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed", maxHeight)}
      >
        {logs.map((line, i) => {
          const { color } = colorize(line);
          return (
            <div key={i} className={cn("whitespace-pre-wrap break-all", color)}>
              <span className="text-zinc-600 select-none mr-2">{String(i + 1).padStart(3, " ")}</span>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
