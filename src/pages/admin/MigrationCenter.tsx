/**
 * MigrationCenter — Dashboard SaaS do sistema de migração SolarMarket V2.
 *
 * - KPIs com tendência (sparkline)
 * - Toolbar de busca/filtros
 * - Histórico em tabela
 * - Detalhe abre em drawer lateral (Sheet) — mais espaço e foco
 */
import { useState, useMemo, useEffect } from "react";
import { Database, Plus, Loader2, Trash2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMigrationJobs } from "@/hooks/useMigrationJobs";
import { useClearMigrationHistory } from "@/hooks/useClearMigrationHistory";
import { useStagingCounts } from "@/hooks/useMigrationTenant";
import { JobsTable } from "@/components/migration/JobsTable";
import { JobDetailPanel } from "@/components/migration/JobDetailPanel";
import { NewJobModal } from "@/components/migration/NewJobModal";
import { MigrationKpiCards } from "@/components/migration/MigrationKpiCards";
import { JobsToolbar, type JobsFilter } from "@/components/migration/JobsToolbar";
import { TenantSelector } from "@/components/migration/TenantSelector";
import { PreflightPanel } from "@/components/migration/PreflightPanel";
import { useMigrationPreflight } from "@/hooks/useMigrationPreflight";

export default function MigrationCenter() {
  const { data: jobs = [], isLoading } = useMigrationJobs();
  const clearHistory = useClearMigrationHistory();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const { data: stagingCounts } = useStagingCounts(tenantId);
  const { data: preflight } = useMigrationPreflight(tenantId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<JobsFilter>({ q: "", status: "all", type: "all" });

  const blockReason: string | null = !tenantId
    ? "Selecione um tenant"
    : (stagingCounts?.total ?? 0) === 0
    ? "Tenant sem dados de staging"
    : preflight?.blockReason ?? null;
  const canCreateJob = !!tenantId && (stagingCounts?.total ?? 0) > 0 && !preflight?.blocked;

  // Auto-abre drawer quando o usuário clica em um job
  const handleSelect = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  const jobTypes = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.job_type))).sort(),
    [jobs],
  );

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filter.status !== "all" && j.status !== filter.status) return false;
      if (filter.type !== "all" && j.job_type !== filter.type) return false;
      if (filter.q.trim()) {
        const q = filter.q.trim().toLowerCase();
        if (!j.id.toLowerCase().includes(q) && !j.job_type.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [jobs, filter]);

  // Mantém a seleção válida (se filtrar e a seleção sumir, abrir o primeiro)
  useEffect(() => {
    if (selectedId && !jobs.find((j) => j.id === selectedId)) {
      setSelectedId(null);
      setDrawerOpen(false);
    }
  }, [jobs, selectedId]);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Database}
        title="Centro de Migração"
        description="Gerencie jobs de migração SolarMarket → sistema nativo (V2)."
        actions={
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={clearHistory.isPending || jobs.length === 0}>
                  {clearHistory.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Limpar histórico
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar histórico de jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove todos os jobs <strong>concluídos, falhos e revertidos</strong> deste tenant.
                    Jobs em execução serão preservados. Os dados nativos (clientes, projetos, propostas) <strong>não</strong> são afetados — use "Reverter" antes se quiser desfazer uma migração.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearHistory.mutate("finished")}>
                    Limpar finalizados
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              onClick={() => setNewOpen(true)}
              disabled={!canCreateJob}
              title={blockReason ?? undefined}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo job
            </Button>
          </div>
        }
      />

      <TenantSelector value={tenantId} onChange={setTenantId} />

      <PreflightPanel tenantId={tenantId} />

      <MigrationKpiCards jobs={jobs} />

      <SectionCard
        title="Histórico de jobs"
        variant="neutral"
        actions={
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {filtered.length} de {jobs.length}
          </span>
        }
      >
        <div className="space-y-3">
          <JobsToolbar filter={filter} onChange={setFilter} jobTypes={jobTypes} />
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <JobsTable jobs={filtered} selectedId={selectedId} onSelect={handleSelect} />
          )}
        </div>
      </SectionCard>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Detalhes do job</SheetTitle>
          </SheetHeader>
          {selectedId && <JobDetailPanel jobId={selectedId} />}
        </SheetContent>
      </Sheet>

      <NewJobModal
        open={newOpen}
        onOpenChange={setNewOpen}
        tenantId={tenantId}
        blocked={!canCreateJob}
        blockReason={blockReason}
        onCreated={(id) => {
          setSelectedId(id);
          setDrawerOpen(true);
        }}
      />
    </div>
  );
}
