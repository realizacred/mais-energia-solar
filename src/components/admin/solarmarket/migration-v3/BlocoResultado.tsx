/**
 * BlocoResultado — Log/erros derivados do mesmo UnifiedRunResult.
 */
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui-kit";
import { SmTerminalLog } from "@/components/admin/solarmarket/SmTerminalLog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UnifiedRunResult } from "@/hooks/useSmMigrationRun";

interface Props {
  run: UnifiedRunResult;
}

export function BlocoResultado({ run }: Props) {
  if (!run.startedAt) {
    return (
      <SectionCard icon={Inbox} title="Resultado da última rodada" variant="neutral">
        <EmptyState
          icon={Inbox}
          title="Nenhuma migração executada ainda"
          description="Clique em &quot;Migrar dados do SolarMarket&quot; para iniciar."
        />
      </SectionCard>
    );
  }

  const ok = run.failedCount === 0 && !!run.finishedAt;
  const failed = run.failedCount;

  return (
    <SectionCard
      icon={ok ? CheckCircle2 : AlertTriangle}
      title="Resultado da migração"
      variant="neutral"
      actions={
        run.finishedAt ? (
          <Badge variant="outline" className={cn("text-[10px]", ok ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}>
            {ok ? "Concluído com sucesso" : `${failed} falha(s)`}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Em execução</Badge>
        )
      }
    >
      <div className="space-y-3">
        {failed > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {failed} item(ns) falharam
            </p>
            {run.failedSample.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-mono text-destructive/90 max-h-40 overflow-y-auto">
                {run.failedSample.map((s, i) => (
                  <li key={i} className="truncate">
                    <span className="text-muted-foreground">[{s.phase}][{String(s.ref)}]</span> {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <SmTerminalLog logs={run.logLines} maxHeight="max-h-72" />
      </div>
    </SectionCard>
  );
}
