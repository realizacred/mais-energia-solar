/**
 * JobDetailPanel — Detalhe de um job: progresso, contadores, erros, ações.
 */
import { Loader2, RotateCcw, AlertTriangle, CheckCircle2, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/ui-kit";
import { useMigrationJobStatus } from "@/hooks/useMigrationJobStatus";
import { GroupedErrorsList } from "./GroupedErrorsList";
import { useMigrationRollback } from "@/hooks/useMigrationRollback";
import { useCancelMigrationJob } from "@/hooks/useCancelMigrationJob";
import { JobStatusBadge } from "./JobStatusBadge";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  jobId: string;
}

export function JobDetailPanel({ jobId }: Props) {
  const { data, isLoading } = useMigrationJobStatus(jobId);
  const rollback = useMigrationRollback();
  const cancel = useCancelMigrationJob();

  if (isLoading || !data) {
    return (
      <SectionCard title="Detalhes do job" variant="neutral">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      </SectionCard>
    );
  }

  const { job, counters, total, progress, errors } = data;
  const canRollback = job.status === "completed" || job.status === "failed";
  const canCancel = job.status === "pending" || job.status === "running";

  return (
    <SectionCard
      title={`Job ${job.id.slice(0, 8)} · ${job.job_type}`}
      variant="neutral"
      actions={<JobStatusBadge status={job.status} />}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="tabular-nums">{progress}% · {total} registros</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <Counter label="Pendentes" value={counters.pending} />
          <Counter label="Processando" value={counters.processing} tone="text-primary" />
          <Counter label="Migrados" value={counters.migrated} tone="text-success" />
          <Counter label="Pulados" value={counters.skipped} tone="text-muted-foreground" />
          <Counter label="Falhas" value={counters.failed} tone={counters.failed > 0 ? "text-destructive" : undefined} />
        </div>

        {job.error_message && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{job.error_message}</span>
          </div>
        )}

        {errors.length > 0 && (
          <GroupedErrorsList errors={errors} jobId={jobId} />
        )}

        {job.status === "completed" && counters.failed === 0 && (
          <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Concluído sem falhas.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={cancel.isPending}>
                  {cancel.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <StopCircle className="h-4 w-4 mr-2" />}
                  Parar job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Parar este job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O job será marcado como falho e o executor interromperá no próximo ciclo (~30s).
                    Os registros já migrados permanecem; use "Reverter" depois se quiser desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancel.mutate(jobId)}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canRollback && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={rollback.isPending}>
                  {rollback.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Reverter job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reverter este job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todos os registros nativos criados por este job (clientes, projetos e propostas) serão deletados.
                    Esta operação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => rollback.mutate(jobId)}>Confirmar rollback</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className={cn("text-xl font-semibold tabular-nums leading-none", tone)}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
