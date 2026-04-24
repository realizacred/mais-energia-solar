/**
 * Migração SolarMarket — Step 3 (Migrar dados para o CRM).
 *
 * UI 1-clique: 1 botão + 3 barras de progresso (clientes/projetos/propostas).
 * Roda em background no servidor (sm-promote, scope=proposta com cascata).
 * Pode fechar a aba — polling reanexa ao job ativo automaticamente.
 *
 * Mantém header "Step 3 — Migrar dados para o CRM" e botão "Voltar para mapeamentos".
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users,
  FolderKanban,
  FileText,
  Play,
  X,
  Eraser,
  Sparkles,
  Download,
  Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMigrateFull } from "@/hooks/useMigrateFull";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";
import { toast } from "@/hooks/use-toast";
import {
  PromotionLogsDialog,
  type LogsFilter,
} from "@/components/admin/solarmarket/PromotionLogsDialog";

function StatRow({
  icon: Icon,
  label,
  promoted,
  total,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  promoted: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((promoted / total) * 100)) : 0;
  const done = total > 0 && promoted >= total;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className={done ? "text-success font-bold" : "text-foreground"}>
            {promoted.toLocaleString("pt-BR")}
          </span>
          <span className="text-muted-foreground">
            / {total.toLocaleString("pt-BR")}
          </span>
          {done && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function PhaseRow({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  status: "pending" | "running" | "completed";
  detail: string;
}) {
  const tone =
    status === "completed"
      ? "text-success"
      : status === "running"
        ? "text-info"
        : "text-muted-foreground";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-info" />}
          {status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
          <span className={`font-mono ${tone}`}>
            {status === "pending" ? "aguardando" : status === "running" ? "rodando" : "ok"}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground pl-6">{detail}</p>
    </div>
  );
}

export default function MigracaoStep3Migrar() {
  const { start, cancel, progress, isLoading } = useMigrateFull();
  const resetMigrated = useResetMigratedData();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsFilter, setLogsFilter] = useState<LogsFilter>("all");

  const openLogs = (f: LogsFilter) => {
    setLogsFilter(f);
    setLogsOpen(true);
  };

  const handleStart = async () => {
    try {
      const res = await start.mutateAsync({ batch_limit: 10000, dry_run: false });
      toast({
        title: "Migração iniciada",
        description: `Job ${res.job_id.slice(0, 8)}… em execução. Pode fechar a aba — segue rodando.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao iniciar migração", description: msg, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!progress?.job?.id) return;
    try {
      await cancel.mutateAsync(progress.job.id);
      toast({ title: "Job cancelado" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao cancelar", description: msg, variant: "destructive" });
    }
  };

  const handleClearArea = async () => {
    try {
      await resetMigrated.mutateAsync();
      setConfirmOpen(false);
      toast({ title: "Área de promoção limpa" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao limpar área", description: msg, variant: "destructive" });
    }
  };

  const totals = progress?.totals;
  const job = progress?.job;
  const isRunning = !!progress?.isRunning;
  const isComplete = !!progress?.isComplete;
  const totalStaging =
    (totals?.clientes.total ?? 0) +
    (totals?.projetos.total ?? 0) +
    (totals?.propostas.total ?? 0);
  const totalPromoted =
    (totals?.clientes.promoted ?? 0) +
    (totals?.projetos.promoted ?? 0) +
    (totals?.propostas.promoted ?? 0);
  const nothingToDo = totalStaging === 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      {/* Header preservado */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket/mapear">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para mapeamentos
          </Link>
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">
            Step 3 — Migrar dados para o CRM
          </h1>
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 gap-1.5"
          >
            <Sparkles className="w-3 h-3" /> 1-clique
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Promove clientes, projetos e propostas em uma única operação.
          Idempotente: registros já migrados são ignorados. Roda em background —
          pode fechar a aba.
        </p>
      </div>

      {/* Card principal — barras + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Banner de status */}
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estado da migração…
              </div>
            ) : isRunning ? (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-info/10 border border-info/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Loader2 className="w-5 h-5 animate-spin text-info shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      Migração em andamento
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Job {job?.id.slice(0, 8)}… • {job?.items_processed ?? 0} de{" "}
                      {job?.total_items ?? 0} processados. Pode fechar a aba.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={cancel.isPending}
                >
                  <X className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            ) : isComplete && totalPromoted > 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Última execução concluída — {totalPromoted.toLocaleString("pt-BR")}{" "}
                    registros promovidos
                  </p>
                  {(job?.items_with_errors ?? 0) > 0 && (
                    <p className="text-xs text-warning">
                      {job?.items_with_errors} com erro ·{" "}
                      {job?.items_with_warnings ?? 0} avisos
                    </p>
                  )}
                </div>
              </div>
            ) : nothingToDo ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Nenhum dado em staging. Importe os dados primeiro na{" "}
                  <Link
                    to="/admin/migracao-solarmarket"
                    className="text-primary underline"
                  >
                    Step 1
                  </Link>
                  .
                </p>
              </div>
            ) : null}

            {/* Progresso por entidade */}
            <div className="space-y-5">
              <StatRow
                icon={Users}
                label="Clientes"
                promoted={totals?.clientes.promoted ?? 0}
                total={totals?.clientes.total ?? 0}
              />
              <StatRow
                icon={FolderKanban}
                label="Projetos"
                promoted={totals?.projetos.promoted ?? 0}
                total={totals?.projetos.total ?? 0}
              />
              <StatRow
                icon={FileText}
                label="Propostas"
                promoted={totals?.propostas.promoted ?? 0}
                total={totals?.propostas.total ?? 0}
              />

              {/* Fases extras (rodam automaticamente após as propostas) */}
              <div className="pt-3 border-t border-border space-y-5">
                <PhaseRow
                  icon={Download}
                  label="Campos customizados & arquivos"
                  status={progress?.phases.customFields.status ?? "pending"}
                  detail={
                    progress?.phases.customFields.processed
                      ? `${progress.phases.customFields.processed.toLocaleString("pt-BR")} projetos · ${progress.phases.customFields.files_downloaded.toLocaleString("pt-BR")} arquivos baixados`
                      : "Aguardando…"
                  }
                />
                <PhaseRow
                  icon={Package}
                  label="Enriquecer propostas (kit, financeiro, UCs)"
                  status={progress?.phases.enrichment.status ?? "pending"}
                  detail={
                    progress?.phases.enrichment.processed
                      ? `${progress.phases.enrichment.processed.toLocaleString("pt-BR")} propostas · ${progress.phases.enrichment.versoes_updated.toLocaleString("pt-BR")} versões · ${progress.phases.enrichment.ucs_inserted.toLocaleString("pt-BR")} UCs`
                      : "Aguardando…"
                  }
                />
              </div>
            </div>

            {/* CTA */}
            <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {isRunning
                  ? `Progresso geral: ${progress?.pctGeral ?? 0}%`
                  : "Idempotente: registros já migrados são ignorados automaticamente."}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetMigrated.isPending || isRunning}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    >
                      {resetMigrated.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eraser className="w-4 h-4" />
                      )}
                      Limpar área
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[90vw] max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Limpar área de promoção (DEV)</AlertDialogTitle>
                      <AlertDialogDescription>
                        Apaga TODOS os registros canônicos criados pela promoção
                        (clientes, projetos, propostas, versões) com origem{" "}
                        <code>solar_market</code>.
                        <br />
                        <br />
                        Não afeta o staging (<code>sm_*_raw</code>). Use apenas em DEV.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearArea}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Limpar tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={isRunning || start.isPending || nothingToDo}
                  className="gap-2"
                >
                  {start.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Iniciando…
                    </>
                  ) : isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Em execução…
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" /> Iniciar migração completa
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detalhes do job (compacto) */}
      {job && (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Última execução</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-mono font-bold text-foreground">{job.status}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Promovidos</p>
                <p className="font-mono font-bold text-success">{job.items_promoted}</p>
              </div>
              <button
                type="button"
                onClick={() => job.items_with_warnings > 0 && openLogs("warning")}
                disabled={job.items_with_warnings === 0}
                className="text-left rounded-md -m-1 p-1 transition-colors hover:bg-warning/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <p className="text-muted-foreground group-hover:text-foreground">
                  Avisos {job.items_with_warnings > 0 && <span className="text-[10px]">(ver)</span>}
                </p>
                <p className="font-mono font-bold text-warning">
                  {job.items_with_warnings}
                </p>
              </button>
              <button
                type="button"
                onClick={() => job.items_with_errors > 0 && openLogs("error")}
                disabled={job.items_with_errors === 0}
                className="text-left rounded-md -m-1 p-1 transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <p className="text-muted-foreground">
                  Erros {job.items_with_errors > 0 && <span className="text-[10px]">(ver)</span>}
                </p>
                <p className="font-mono font-bold text-destructive">
                  {job.items_with_errors}
                </p>
              </button>
            </div>
            {(job.items_with_warnings > 0 || job.items_with_errors > 0) && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => openLogs("all")}
                >
                  Ver todos os logs deste job
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <PromotionLogsDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        jobId={job?.id ?? null}
        initialFilter={logsFilter}
        warningsCount={job?.items_with_warnings ?? 0}
        errorsCount={job?.items_with_errors ?? 0}
      />
    </div>
  );
}
