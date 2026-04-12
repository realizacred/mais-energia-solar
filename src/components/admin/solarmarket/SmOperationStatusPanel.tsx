/**
 * SmOperationStatusPanel — Shows real-time operation status from sm_operation_runs SSOT.
 * Only visible when there's an active operation or a recent completed/failed one.
 */
import { cn } from "@/lib/utils";
import { useActiveSmOperation, useLastCompletedSmOperation } from "@/hooks/useSmOperationRuns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Clock, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const OP_LABELS: Record<string, string> = {
  sync_staging: "Sincronização Staging",
  solarmarket_sync: "Sincronização Staging",
  sync_proposals: "Sincronização Propostas",
  migrate_to_native: "Migração para Nativo",
  reset_staging: "Reset Staging",
  reset_migrated: "Reset Migrados",
};

function getOpLabel(type: string): string {
  return OP_LABELS[type] || type;
}

export function SmOperationStatusPanel() {
  const { data: activeRun } = useActiveSmOperation();
  const { data: lastRun } = useLastCompletedSmOperation();

  // Show active run panel
  if (activeRun) {
    const isStale = (activeRun as any)._stale === true;
    const percent = activeRun.total_items > 0
      ? Math.round((activeRun.processed_items / activeRun.total_items) * 100)
      : 0;
    const remaining = activeRun.total_items - activeRun.processed_items;

    return (
      <div className={cn(
        "rounded-lg border p-4 space-y-3",
        isStale
          ? "border-warning/40 bg-warning/5"
          : "border-primary/30 bg-primary/5"
      )}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isStale ? (
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isStale ? "Operação possivelmente travada" : getOpLabel(activeRun.operation_type)}
              </p>
              <p className="text-xs text-muted-foreground">
                {isStale
                  ? "Sem heartbeat há mais de 15 minutos"
                  : activeRun.heartbeat_at
                    ? `Último sinal: ${formatDistanceToNow(new Date(activeRun.heartbeat_at), { addSuffix: true, locale: ptBR })}`
                    : "Aguardando início..."
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(
              "text-[10px]",
              isStale ? "bg-warning/10 text-warning border-warning/20" : "bg-primary/10 text-primary border-primary/20"
            )}>
              {isStale ? "Stale" : activeRun.status}
            </Badge>
          </div>
        </div>

        {activeRun.total_items > 0 && (
          <>
            <Progress value={percent} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">
                {activeRun.processed_items} / {activeRun.total_items} processados
              </span>
              <div className="flex items-center gap-3">
                {activeRun.success_items > 0 && (
                  <span className="text-success font-mono">{activeRun.success_items} ✓</span>
                )}
                {activeRun.error_items > 0 && (
                  <span className="text-destructive font-mono">{activeRun.error_items} ✗</span>
                )}
                {activeRun.skipped_items > 0 && (
                  <span className="text-muted-foreground font-mono">{activeRun.skipped_items} →</span>
                )}
                <span className="font-medium">{remaining} restantes</span>
                <span className="font-mono">{percent}%</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Show last completed/failed run as context (non-intrusive)
  if (lastRun) {
    const isFailed = lastRun.status === "failed";
    const finishedAgo = lastRun.finished_at
      ? formatDistanceToNow(new Date(lastRun.finished_at), { addSuffix: true, locale: ptBR })
      : "—";

    return (
      <div className={cn(
        "rounded-lg border px-4 py-2.5 flex items-center gap-3 text-sm",
        isFailed
          ? "border-destructive/20 bg-destructive/5"
          : "border-success/20 bg-success/5"
      )}>
        {isFailed ? (
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <CheckCircle className="h-4 w-4 text-success shrink-0" />
        )}
        <span className="text-foreground">
          {getOpLabel(lastRun.operation_type)}
          {isFailed ? " falhou" : " concluída"}
          {" "}{finishedAgo}
        </span>
        {lastRun.success_items > 0 && (
          <span className="text-xs text-muted-foreground font-mono ml-auto">
            {lastRun.success_items}/{lastRun.total_items} processados
          </span>
        )}
        {isFailed && lastRun.error_summary && (
          <span className="text-xs text-destructive truncate max-w-xs" title={lastRun.error_summary}>
            {lastRun.error_summary}
          </span>
        )}
      </div>
    );
  }

  return null;
}
