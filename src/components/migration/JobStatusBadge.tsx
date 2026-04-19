/**
 * JobStatusBadge — Badge colorido por status de job.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "border-warning/40 text-warning" },
  running: { label: "Em execução", cls: "border-primary/40 text-primary" },
  stalled: { label: "Travado", cls: "border-warning/60 text-warning bg-warning/5" },
  completed: { label: "Concluído", cls: "border-success/40 text-success" },
  failed: { label: "Falhou", cls: "border-destructive/40 text-destructive" },
  rolled_back: { label: "Revertido", cls: "border-muted-foreground/40 text-muted-foreground" },
};

export function JobStatusBadge({ status, stalled }: { status: string; stalled?: boolean }) {
  const key = stalled && status === "running" ? "stalled" : status;
  const m = MAP[key] ?? { label: status, cls: "border-muted-foreground/40 text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("text-[10px]", m.cls)}>
      {m.label}
    </Badge>
  );
}
