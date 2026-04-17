/**
 * BlocoExecucao — Botão único de migração + stepper visual + barra de progresso.
 * O sistema executa classify → create → apply em sequência.
 */
import { Rocket, Loader2, RotateCcw, CheckCircle2, XCircle, Circle, Ban, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import type { UnifiedRunResult, PhaseStatus } from "@/hooks/useSmMigrationRun";

interface Props {
  run: UnifiedRunResult;
  isRunning: boolean;
  onStart: () => void;
  onReset: () => void;
  onCancel?: () => void;
}

export function BlocoExecucao({ run, isRunning, onStart, onReset, onCancel }: Props) {
  const finished = !!run.finishedAt && !isRunning;

  return (
    <SectionCard
      icon={Rocket}
      title="Execução"
      description="Inicie a migração. O sistema classifica, cria projetos nativos e aplica funis automaticamente."
      variant="neutral"
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="lg"
            className="flex-1 h-12 text-sm font-medium"
            onClick={onStart}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Migrando...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Migrar dados do SolarMarket
              </>
            )}
          </Button>
          {isRunning && onCancel && (
            <Button
              size="lg"
              variant="destructive"
              className="h-12"
              onClick={onCancel}
              title="Aguarda o lote atual terminar e interrompe os próximos"
            >
              <Ban className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>

        {(isRunning || finished) && (
          <>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso</span>
                <span className="tabular-nums">{run.progress}%</span>
              </div>
              <Progress value={run.progress} className="h-2" />
            </div>

            <ul className="space-y-1.5">
              {run.phases.map((p) => (
                <PhaseRow key={p.key} phase={p} />
              ))}
            </ul>
          </>
        )}

        {finished && (
          <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Limpar resultado
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

function PhaseRow({ phase }: { phase: PhaseStatus }) {
  const Icon =
    phase.status === "success" ? CheckCircle2 :
    phase.status === "error" ? XCircle :
    phase.status === "running" ? Loader2 : Circle;
  const tone =
    phase.status === "success" ? "text-success" :
    phase.status === "error" ? "text-destructive" :
    phase.status === "running" ? "text-primary" : "text-muted-foreground";

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn("h-4 w-4 shrink-0", tone, phase.status === "running" && "animate-spin")} />
        <span className="truncate">{phase.label}</span>
      </div>
      {(phase.status === "success" || phase.status === "error") && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {phase.successCount} ok
          {phase.failedCount > 0 && <span className="text-destructive ml-1">· {phase.failedCount} falha(s)</span>}
        </span>
      )}
    </li>
  );
}
