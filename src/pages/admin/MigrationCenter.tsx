/**
 * MigrationCenter — Dashboard do novo sistema de migração SolarMarket V2.
 *
 * Histórico de jobs + criação de novos jobs + detalhe em tempo real + rollback.
 * Não substitui a aba antiga; é uma área dedicada acessível em /admin/migration-center.
 */
import { useState, useMemo, useEffect } from "react";
import { Database, Plus, Loader2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { useMigrationJobs } from "@/hooks/useMigrationJobs";
import { JobsTable } from "@/components/migration/JobsTable";
import { JobDetailPanel } from "@/components/migration/JobDetailPanel";
import { NewJobModal } from "@/components/migration/NewJobModal";

export default function MigrationCenter() {
  const { data: jobs = [], isLoading } = useMigrationJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Auto-seleciona o job mais recente quando carrega
  useEffect(() => {
    if (!selectedId && jobs.length > 0) setSelectedId(jobs[0].id);
  }, [jobs, selectedId]);

  const summary = useMemo(() => {
    return {
      total: jobs.length,
      running: jobs.filter((j) => j.status === "running" || j.status === "pending").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
    };
  }, [jobs]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Database}
        title="Centro de Migração"
        description="Gerencie jobs de migração SolarMarket → sistema nativo (V2)."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo job
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total de jobs" value={summary.total} />
        <Stat label="Em execução" value={summary.running} tone="text-primary" />
        <Stat label="Concluídos" value={summary.completed} tone="text-success" />
        <Stat label="Falhas" value={summary.failed} tone={summary.failed > 0 ? "text-destructive" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <SectionCard title="Histórico de jobs" variant="neutral">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <JobsTable jobs={jobs} selectedId={selectedId} onSelect={setSelectedId} />
            )}
          </SectionCard>
        </div>
        <div className="lg:col-span-2">
          {selectedId ? (
            <JobDetailPanel jobId={selectedId} />
          ) : (
            <SectionCard title="Detalhes" variant="neutral">
              <p className="text-sm text-muted-foreground">Selecione um job para ver os detalhes.</p>
            </SectionCard>
          )}
        </div>
      </div>

      <NewJobModal
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-2xl font-semibold tabular-nums leading-none ${tone ?? ""}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
