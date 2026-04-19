/**
 * JobStatusBadge — Badge colorido por status de job.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "border-warning/40 text-warning" },
  running: { label: "Em execução", cls: "border-primary/40 text-primary" },
  completed: { label: "Concluído", cls: "border-success/40 text-success" },
  failed: { label: "Falhou", cls: "border-destructive/40 text-destructive" },
  rolled_back: { label: "Revertido", cls: "border-muted-foreground/40 text-muted-foreground" },
};

export function JobStatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, cls: "border-muted-foreground/40 text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("text-[10px]", m.cls)}>
      {m.label}
    </Badge>
  );
}
