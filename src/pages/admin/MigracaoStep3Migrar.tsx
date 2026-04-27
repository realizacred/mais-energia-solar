/**
 * Migração SolarMarket — Step 3 (Migrar dados para o CRM).
 *
 * UI 1-clique: 1 botão + 3 barras de progresso (clientes/projetos/propostas).
 * Roda em background no servidor via `sm-migrate-chunk`.
 * Pode fechar a aba — polling reanexa ao job ativo automaticamente.
 *
 * Mantém header "Step 3 — Migrar dados para o CRM" e botão "Voltar para mapeamentos".
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Eraser,
  FileText,
  FolderKanban,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useChunkedMigration } from "@/hooks/useChunkedMigration";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";
import { useTenantId } from "@/hooks/useTenantId";
import { toast } from "@/hooks/use-toast";
import { PromotionLogsDialog, type LogsFilter } from "@/components/admin/solarmarket/PromotionLogsDialog";
import { CustomFieldsMappingSummary } from "@/components/admin/solarmarket/migracao/CustomFieldsMappingSummary";

function formatRelativeTimestamp(value: string | null) {
  if (!value) return "sem atividade registrada";
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR });
}

function formatJobStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "running":
      return "Em execução";
    case "completed":
      return "Concluído";
    case "completed_with_warnings":
      return "Concluído com avisos";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return "Sem job";
  }
}

type PhaseState = "done" | "active" | "pending" | "empty";

function PhaseCard({
  step,
  icon: Icon,
  label,
  promoted,
  total,
  state,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  promoted: number;
  total: number;
  state: PhaseState;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((promoted / total) * 100)) : 0;
  const remaining = Math.max(0, total - promoted);

  const containerClass =
    state === "done"
      ? "border-success/40 bg-success/5"
      : state === "active"
        ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
        : "border-border bg-muted/30 opacity-70";

  const iconWrapClass =
    state === "done"
      ? "bg-success/15 text-success"
      : state === "active"
        ? "bg-primary/15 text-primary"
        : "bg-muted text-muted-foreground";

  const statusBadge =
    state === "done" ? (
      <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 text-[10px] h-5">
        <CheckCircle2 className="w-3 h-3" /> Concluído
      </Badge>
    ) : state === "active" ? (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1 text-[10px] h-5">
        <Loader2 className="w-3 h-3 animate-spin" /> Em andamento
      </Badge>
    ) : state === "empty" ? (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] h-5">
        Sem dados
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] h-5">
        {step === 1 ? "Aguardando início" : `Aguardando fase ${step - 1}`}
      </Badge>
    );

  return (
    <div className={`rounded-lg border p-4 transition-colors ${containerClass}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconWrapClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Fase {step}
            </p>
            <p className="text-sm font-semibold text-foreground">{label}</p>
          </div>
        </div>
        {statusBadge}
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className={`text-lg font-bold tracking-tight ${state === "done" ? "text-success" : "text-foreground"}`}>
            {promoted.toLocaleString("pt-BR")}
          </span>
          <span className="text-xs text-muted-foreground">/ {total.toLocaleString("pt-BR")}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      {state !== "done" && state !== "empty" && remaining > 0 && (
        <p className="text-[11px] text-muted-foreground mt-2">
          {remaining.toLocaleString("pt-BR")} pendente{remaining > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}


export default function MigracaoStep3Migrar() {
  const { start, continueJob, cancel, progress, isLoading } = useChunkedMigration();
  const resetMigrated = useResetMigratedData();
  const { data: tenantId } = useTenantId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsFilter, setLogsFilter] = useState<LogsFilter>("all");

  const handleStart = async () => {
    try {
      const res = await start.mutateAsync();
      toast({
        title: "Migração iniciada",
        description: `Job ${res.master_job_id?.slice(0, 8) ?? ""}… em execução. Pode fechar a aba — segue rodando.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao iniciar migração", description: msg, variant: "destructive" });
    }
  };

  const handleContinue = async () => {
    if (!progress?.job?.id) return;
    try {
      await continueJob.mutateAsync(progress.job.id);
      toast({
        title: "Migração retomada",
        description: "O processamento voltou a rodar em background.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao retomar", description: msg, variant: "destructive" });
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
  const isResumable = !!progress?.isResumable;
  const isStuck = !!progress?.isStuck;
  const totalStaging =
    (totals?.clientes.total ?? 0) +
    (totals?.projetos.total ?? 0) +
    (totals?.propostas.total ?? 0);
  const totalPromoted =
    (totals?.clientes.promoted ?? 0) +
    (totals?.projetos.promoted ?? 0) +
    (totals?.propostas.promoted ?? 0);
  const totalPending = Math.max(0, totalStaging - totalPromoted);
  const nothingToDo = totalStaging === 0;
  const lastActivityLabel = formatRelativeTimestamp(progress?.lastActivityAt ?? null);
  const statusLabel = formatJobStatusLabel(job?.status);
  const executionState = progress?.executionState;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket/custom-fields">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para campos customizados
          </Link>
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">Step 4 — Migrar dados para o CRM</h1>
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

      {tenantId && <CustomFieldsMappingSummary tenantId={tenantId} />}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estado da migração…
              </div>
            ) : executionState === "running_stalled" ? (
              <div className="flex flex-col gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Sem atividade recente no job</p>
                    <p className="text-xs text-muted-foreground">
                      Job {job?.id.slice(0, 8)}… continua marcado como em execução, mas o último avanço foi {lastActivityLabel}.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Se esse tempo continuar aumentando, use retomar para forçar o próximo lote.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleContinue} disabled={continueJob.isPending}>
                  {continueJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Retomar agora
                </Button>
              </div>
            ) : executionState === "running_active" ? (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-info/10 border border-info/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Loader2 className="w-5 h-5 animate-spin text-info shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Migração rodando agora</p>
                    <p className="text-xs text-muted-foreground">
                      Job {job?.id.slice(0, 8)}… • {job?.items_processed ?? 0} de {job?.total_items ?? 0} processados • última atividade {lastActivityLabel}.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pode fechar a aba: a execução continua no servidor e esta tela só acompanha o andamento real.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending}>
                  <X className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            ) : executionState === "resumable" ? (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertCircle className="w-5 h-5 text-warning shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Última migração interrompida</p>
                    <p className="text-xs text-muted-foreground">
                      {job?.error_summary ?? "Ainda existem registros pendentes para migrar."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Última atividade {lastActivityLabel} • faltam {totalPending.toLocaleString("pt-BR")} registros para alcançar o staging atual.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleContinue} disabled={continueJob.isPending}>
                  {continueJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Continuar
                </Button>
              </div>
            ) : executionState === "completed" && totalPromoted > 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Migração concluída para o staging atual</p>
                  <p className="text-xs text-muted-foreground">
                    {totalPromoted.toLocaleString("pt-BR")} registros já existem no CRM e a última atividade foi {lastActivityLabel}.
                  </p>
                  {(job?.items_with_errors ?? 0) > 0 || (job?.items_with_warnings ?? 0) > 0 ? (
                    <p className="text-xs text-warning">
                      {job?.items_with_errors ?? 0} erros · {job?.items_with_warnings ?? 0} avisos na última execução
                    </p>
                  ) : null}
                </div>
              </div>
            ) : executionState === "empty" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Nenhum dado em staging. Importe os dados primeiro na <Link to="/admin/migracao-solarmarket" className="text-primary underline">Step 1</Link>.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Rocket className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Pronto para iniciar a migração</p>
                  <p className="text-xs text-muted-foreground">
                    Há {totalStaging.toLocaleString("pt-BR")} registros no staging e {totalPromoted.toLocaleString("pt-BR")} já promovidos no CRM.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">No staging</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{totalStaging.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Já no CRM</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{totalPromoted.toLocaleString("pt-BR")}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Ainda pendentes</p>
                <p className="text-2xl font-bold tracking-tight text-foreground">{totalPending.toLocaleString("pt-BR")}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Como ler os números</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cada linha compara o total encontrado no staging com o total já criado no CRM. Se o número da direita ainda estiver maior, essa entidade continua pendente.
              </p>
            </div>

            {(() => {
              const phases = [
                {
                  step: 1,
                  icon: Users,
                  label: "Clientes",
                  promoted: totals?.clientes.promoted ?? 0,
                  total: totals?.clientes.total ?? 0,
                },
                {
                  step: 2,
                  icon: FolderKanban,
                  label: "Projetos",
                  promoted: totals?.projetos.promoted ?? 0,
                  total: totals?.projetos.total ?? 0,
                },
                {
                  step: 3,
                  icon: FileText,
                  label: "Propostas e campos adicionais",
                  promoted: totals?.propostas.promoted ?? 0,
                  total: totals?.propostas.total ?? 0,
                },
              ];

              // Primeira fase com pendência define a "ativa"
              const firstPendingIdx = phases.findIndex((p) => p.total > 0 && p.promoted < p.total);

              const phaseStates: PhaseState[] = phases.map((p, idx) => {
                if (p.total === 0) return "empty";
                if (p.promoted >= p.total) return "done";
                // Só marca como "active" (Em andamento) se houver job realmente rodando.
                // Sem job ativo, fases pendentes ficam aguardando — não simulam execução.
                if (idx === firstPendingIdx && isRunning) return "active";
                return "pending";
              });

              return (
                <div className="space-y-3">
                  {phases.map((p, idx) => (
                    <PhaseCard
                      key={p.step}
                      step={p.step}
                      icon={p.icon}
                      label={p.label}
                      promoted={p.promoted}
                      total={p.total}
                      state={phaseStates[idx]}
                    />
                  ))}
                </div>
              );
            })()}

            <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {isRunning
                  ? `Execução interna: ${progress?.pctGeral ?? 0}% das linhas do lote já foram avaliadas pelo motor • CRM real agora: ${totalPromoted.toLocaleString("pt-BR")} registros criados • última atividade ${lastActivityLabel}`
                  : `Status atual: ${statusLabel} • CRM real: ${totalPromoted.toLocaleString("pt-BR")} registros criados • última atividade ${lastActivityLabel}. Registros já migrados são ignorados automaticamente.`}
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
                        (clientes, projetos, propostas, versões) com origem <code>solar_market</code>.
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
                  onClick={isResumable || isStuck ? handleContinue : handleStart}
                  disabled={isRunning || start.isPending || continueJob.isPending || nothingToDo}
                  className="gap-2"
                >
                  {start.isPending || continueJob.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {isResumable || isStuck ? "Retomando…" : "Iniciando…"}
                    </>
                  ) : isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Em execução…
                    </>
                  ) : isResumable || isStuck ? (
                    <>
                      <RefreshCw className="w-4 h-4" /> Continuar migração
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

      {job && (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Job atual</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-mono font-bold text-foreground">{statusLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Última atividade</p>
                <p className="font-mono font-bold text-foreground">{lastActivityLabel}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lote processado</p>
                <p className="font-mono font-bold text-success">
                  {job.items_processed} / {job.total_items}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Linhas avaliadas como promovidas pelo motor</p>
                <p className="font-mono font-bold text-foreground">{job.items_promoted}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  setLogsFilter("warning");
                  setLogsOpen(true);
                }}
                disabled={!job.id}
                className="text-left rounded-lg border border-border bg-muted/30 p-3 hover:border-warning/50 hover:bg-warning/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-muted-foreground flex items-center justify-between">
                  Avisos
                  <span className="text-[10px] text-warning underline">ver</span>
                </p>
                <p className="font-mono font-bold text-warning">{job.items_with_warnings}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogsFilter("error");
                  setLogsOpen(true);
                }}
                disabled={!job.id}
                className="text-left rounded-lg border border-border bg-muted/30 p-3 hover:border-destructive/50 hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-muted-foreground flex items-center justify-between">
                  Erros
                  <span className="text-[10px] text-destructive underline">ver</span>
                </p>
                <p className="font-mono font-bold text-destructive">{job.items_with_errors}</p>
              </button>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-muted-foreground">Pulados / bloqueados</p>
                <p className="font-mono font-bold text-foreground">
                  {job.items_skipped} / {job.items_blocked}
                </p>
              </div>
            </div>
            {job.error_summary && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-medium text-foreground">Resumo do erro</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">{job.error_summary}</p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Leitura correta desta seção</p>
              <p className="text-xs text-muted-foreground mt-1">
                Os cards e barras acima mostram o que já existe de verdade no CRM. Esta seção do job mostra o andamento interno do motor de migração e pode avançar antes de aparecer novo total no CRM.
              </p>
            </div>
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
