/**
 * BlocoResumo — KPIs derivados EXCLUSIVAMENTE do UnifiedRunResult.
 * Se houve falha no log, "Falhas" reflete obrigatoriamente.
 */
import { Sparkles, ListChecks, CheckCircle2, AlertOctagon, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedRunResult } from "@/hooks/useSmMigrationRun";

interface Props {
  run: UnifiedRunResult;
  isRunning: boolean;
}

export function BlocoResumo({ run, isRunning }: Props) {
  const cards = [
    { icon: Sparkles, label: "Elegíveis", value: run.eligible, border: "border-l-info", color: "text-info" },
    { icon: ListChecks, label: "Processados", value: run.successCount + run.failedCount, border: "border-l-secondary", color: "text-secondary" },
    { icon: CheckCircle2, label: "Sucesso", value: run.successCount, border: "border-l-success", color: "text-success" },
    {
      icon: AlertOctagon,
      label: "Falhas",
      value: run.failedCount,
      border: run.failedCount > 0 ? "border-l-destructive" : "border-l-muted",
      color: run.failedCount > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      icon: Activity,
      label: isRunning ? "Em execução" : run.finishedAt ? "Finalizado" : "Aguardando",
      value: `${run.progress}%`,
      border: isRunning ? "border-l-primary" : "border-l-muted",
      color: isRunning ? "text-primary" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn("rounded-lg border bg-card p-3 border-l-4 flex items-start gap-3", c.border)}
        >
          <c.icon className={cn("h-5 w-5 mt-0.5 shrink-0", c.color)} />
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums leading-none">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
