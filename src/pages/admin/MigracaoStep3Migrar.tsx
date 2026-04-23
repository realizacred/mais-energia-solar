/**
 * Migração SolarMarket — Step 3 (Migrar dados para o CRM).
 *
 * Fluxo: Resumo (staging) → Dry-Run (simulação) → Migração REAL (com dupla confirmação).
 * Reutiliza a edge `sm-promote` (suporta `dry_run`).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  PlayCircle,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  FolderKanban,
  FileText,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import { useMigrationSummary } from "@/hooks/useMigrationSummary";
import {
  useDryRunMigration,
  type DryRunReport,
} from "@/hooks/useDryRunMigration";
import { useStartMigration } from "@/hooks/useStartMigration";
import { useSolarmarketPromote } from "@/hooks/useSolarmarketPromote";
import { LoadingState } from "@/components/ui-kit/LoadingState";

function formatNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function DistList({ entries }: { entries: Array<[string, number]> }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhum dado.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between text-sm">
          <span className="text-foreground truncate pr-2">{k}</span>
          <span className="font-mono text-muted-foreground">{formatNum(v)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MigracaoStep3Migrar() {
  const { data: tenantId } = useTenantId();
  const summaryQuery = useMigrationSummary(tenantId);
  const dryRun = useDryRunMigration();
  const startMig = useStartMigration();
  const { jobs, cancelJob } = useSolarmarketPromote();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const summary = summaryQuery.data;
  const lastReport: DryRunReport | null = dryRun.data?.report ?? null;

  const runningJob = useMemo(
    () => jobs.find((j) => j.status === "pending" || j.status === "running"),
    [jobs],
  );

  // Procura o último job dry-run "completed" (persiste após reload, ao contrário
  // de dryRun.data que é mutation state). Libera o botão REAL.
  const lastCompletedDryRun = useMemo(
    () =>
      jobs.find(
        (j) =>
          j.status === "completed" &&
          (j.filters as { dry_run?: boolean } | null)?.dry_run === true,
      ),
    [jobs],
  );

  // Permite migração real se:
  // - dry-run da sessão atual rodou sem bloqueios, OU
  // - existe um job dry-run completed no histórico (sobrevive a reload).
  const dryRunOk =
    (dryRun.isSuccess && !!lastReport && lastReport.bloqueados.length === 0) ||
    !!lastCompletedDryRun;

  const recentJobs = useMemo(() => jobs.slice(0, 8), [jobs]);

  const canStartReal = dryRunOk && !startMig.isPending && !runningJob;

  const handleConfirmReal = async () => {
    if (confirmText.trim().toUpperCase() !== "MIGRAR") {
      toast.error('Digite "MIGRAR" para confirmar.');
      return;
    }
    setConfirmOpen(false);
    setConfirmText("");
    try {
      const res = await startMig.mutateAsync({});
      toast.success(`Migração iniciada (job ${res.job_id.slice(0, 8)}…)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar migração.");
    }
  };

  const handleDryRun = async () => {
    try {
      await dryRun.mutateAsync({});
      toast.success("Dry-run concluído. Veja o relatório abaixo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no dry-run.");
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket/mapear">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para mapeamentos
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          Step 3 — Migrar dados para o CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Criar clientes, projetos e propostas no seu CRM a partir dos dados importados.
        </p>
      </div>

      {/* Resumo */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Resumo da migração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {summaryQuery.isLoading ? (
            <LoadingState message="Calculando resumo do staging..." />
          ) : summaryQuery.error ? (
            <p className="text-sm text-destructive">
              Erro ao calcular resumo:{" "}
              {summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : "desconhecido"}
            </p>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                        {formatNum(summary.clientes_a_criar)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Clientes a criar
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <FolderKanban className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                        {formatNum(summary.projetos_a_criar)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Projetos a criar
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                        {formatNum(summary.propostas_a_criar)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Propostas a criar
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Por pipeline
                  </h4>
                  <DistList entries={summary.distribuicaoPorPipeline} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Por consultor
                  </h4>
                  <DistList entries={summary.distribuicaoPorConsultor} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Por status
                  </h4>
                  <DistList entries={summary.distribuicaoPorStatus} />
                </div>
              </div>

              {summary.funisSemMapeamento.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <p className="text-sm font-medium text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Funis sem mapeamento (deals adicionais serão omitidos)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary.funisSemMapeamento.join(", ")}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Ações */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">
            Ações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={dryRun.isPending || !!runningJob}
              className="flex-1"
            >
              {dryRun.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Simular Migração (Dry-Run)
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canStartReal}
              className="flex-1"
            >
              {startMig.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              Iniciar Migração (REAL)
            </Button>
          </div>
          {!dryRunOk && (
            <p className="text-xs text-muted-foreground">
              {lastReport && lastReport.bloqueados.length > 0
                ? `O dry-run reportou ${lastReport.bloqueados.length} bloqueio(s). Resolva-os antes de migrar.`
                : "Execute um Dry-Run sem bloqueios para liberar a migração real."}
            </p>
          )}
          {runningJob && (
            <div className="rounded-lg border border-info/30 bg-info/10 p-3 flex items-center justify-between">
              <div className="text-sm text-foreground">
                <Loader2 className="w-4 h-4 inline animate-spin mr-2 text-info" />
                Job em andamento ({runningJob.status}) — processados{" "}
                {runningJob.items_processed}/{runningJob.total_items}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  cancelJob.mutate({ job_id: runningJob.id, reason: "Cancelado na UI" })
                }
              >
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatório do Dry-Run */}
      {lastReport && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              {lastReport.bloqueados.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning" />
              )}
              Relatório do Dry-Run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Candidatos</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.total_candidatos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.clientes_a_criar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projetos</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.projetos_a_criar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Propostas</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.propostas_a_criar)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Por pipeline
                </h4>
                <DistList entries={Object.entries(lastReport.distribuicaoPorPipeline)} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Por consultor
                </h4>
                <DistList entries={Object.entries(lastReport.distribuicaoPorConsultor)} />
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  Por stage
                </h4>
                <DistList entries={Object.entries(lastReport.distribuicaoPorStage)} />
              </div>
            </div>

            {lastReport.bloqueados.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-destructive mb-2">
                  Bloqueados ({lastReport.bloqueados.length})
                </h4>
                <ScrollArea className="h-48 rounded-md border border-border">
                  <ul className="divide-y divide-border text-xs">
                    {lastReport.bloqueados.map((b, i) => (
                      <li key={i} className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {b.tipo}/{b.external_id ?? "—"}
                        </span>
                        <span className="ml-2 text-foreground">
                          {b.motivos.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {lastReport.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-warning mb-2">
                  Warnings ({lastReport.warnings.length})
                </h4>
                <ScrollArea className="h-40 rounded-md border border-border">
                  <ul className="divide-y divide-border text-xs">
                    {lastReport.warnings.map((w, i) => (
                      <li key={i} className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {w.tipo}/{w.external_id ?? "—"}
                        </span>
                        <span className="ml-2 text-foreground">{w.mensagem}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" /> Execuções recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma execução registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <ul className="divide-y divide-border text-sm">
                {recentJobs.map((j) => {
                  const isDry = (j.filters as { dry_run?: boolean })?.dry_run === true;
                  const variant =
                    j.status === "completed"
                      ? "success"
                      : j.status === "failed"
                        ? "destructive"
                        : "warning";
                  return (
                    <li key={j.id} className="py-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {new Date(j.created_at).toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}
                      </span>
                      <Badge variant="outline">{isDry ? "DRY-RUN" : "REAL"}</Badge>
                      <Badge
                        className={
                          variant === "success"
                            ? "bg-success/10 text-success border-success/20"
                            : variant === "destructive"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-warning/10 text-warning border-warning/20"
                        }
                      >
                        {j.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {j.items_promoted}/{j.total_items} promovidos · {j.items_blocked} blocked · {j.items_with_errors} erros
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação dupla */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar migração REAL</DialogTitle>
            <DialogDescription>
              Esta ação grava clientes, projetos e propostas no CRM.{" "}
              <strong>Não pode ser desfeita</strong> (apenas via reset).
              Digite <strong>MIGRAR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Digite MIGRAR"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmReal}
              disabled={confirmText.trim().toUpperCase() !== "MIGRAR"}
            >
              Iniciar migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
