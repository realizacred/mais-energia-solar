import { SyncProgress, SyncStageStatus } from "@/hooks/useSolarMarketSync";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, Clock, SkipForward } from "lucide-react";

function StageIcon({ status }: { status: SyncStageStatus["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "done":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground/50" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

interface Props {
  progress: SyncProgress;
}

export function SyncProgressBar({ progress }: Props) {
  const activeStages = progress.stages.filter((s) => s.status !== "skipped");
  const hasActivity = activeStages.some((s) => s.status !== "pending");

  if (!progress.isRunning && !hasActivity) {
    return null;
  }

  const doneCount = activeStages.filter((s) => s.status === "done").length;
  const totalActive = activeStages.length;
  const runningStage = activeStages.find((s) => s.status === "running");
  const percent = progress.isRunning
    ? Math.round(((doneCount + (runningStage ? 0.5 : 0)) / totalActive) * 100)
    : 100;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {progress.isRunning
            ? `Sincronizando... (${doneCount}/${totalActive} etapas)`
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
                : stage.status === "skipped"
                ? "border-border/50 bg-muted/10 opacity-50"
                : "border-border bg-muted/20"
            }`}
          >
            <StageIcon status={stage.status} />
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
              {stage.status === "skipped" && (
                <p className="text-[10px] text-muted-foreground">Pulado</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
