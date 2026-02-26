import { SyncProgress, SyncStageStatus } from "@/hooks/useSolarMarketSync";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, Clock } from "lucide-react";

const stageIcons: Record<SyncStageStatus["status"], React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 text-primary animate-spin" />,
  done: <CheckCircle className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
};

interface Props {
  progress: SyncProgress;
}

export function SyncProgressBar({ progress }: Props) {
  if (!progress.isRunning && progress.stages.every((s) => s.status === "pending")) {
    return null;
  }

  const doneCount = progress.stages.filter((s) => s.status === "done").length;
  const totalStages = progress.stages.length;
  const runningStage = progress.stages.find((s) => s.status === "running");
  const percent = progress.isRunning
    ? Math.round(((doneCount + (runningStage ? 0.5 : 0)) / totalStages) * 100)
    : progress.stages.some((s) => s.status === "error")
    ? 100
    : 100;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {progress.isRunning
            ? `Sincronizando... (${doneCount}/${totalStages} etapas)`
            : "Sincronização finalizada"}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{percent}%</span>
      </div>

      <Progress value={percent} className="h-2" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {progress.stages.map((stage) => (
          <div
            key={stage.stage}
            className={`flex items-center gap-2 rounded-md border p-2.5 transition-colors ${
              stage.status === "running"
                ? "border-primary/40 bg-primary/5"
                : stage.status === "done"
                ? "border-success/30 bg-success/5"
                : stage.status === "error"
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-muted/20"
            }`}
          >
            {stageIcons[stage.status]}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{stage.label}</p>
              {stage.status === "running" && (
                <p className="text-[10px] text-muted-foreground">Processando...</p>
              )}
              {stage.status === "done" && (
                <p className="text-[10px] text-muted-foreground">
                  {stage.fetched} encontrados → {stage.upserted} importados
                </p>
              )}
              {stage.status === "error" && stage.errorMessage && (
                <p className="text-[10px] text-destructive truncate">{stage.errorMessage}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
