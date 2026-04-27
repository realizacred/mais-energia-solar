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
import { motion } from "framer-motion";
import { MigrationLayout } from "@/components/admin/solarmarket/MigrationLayout";
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

function PhaseTimelineItem({
  step,
  icon: Icon,
  label,
  promoted,
  total,
  state,
  isLast,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  promoted: number;
  total: number;
  state: PhaseState;
  isLast: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((promoted / total) * 100)) : 0;
  const remaining = Math.max(0, total - promoted);

  const containerClass =
    state === "done"
      ? "border-success/40 bg-success/5"
      : state === "active"
        ? "border-primary/60 bg-primary/5 shadow-md ring-2 ring-primary/20"
        : state === "empty"
          ? "border-dashed border-border bg-muted/20 opacity-60"
          : "border-border bg-card";

  const ringClass =
    state === "done"
      ? "bg-success text-success-foreground"
      : state === "active"
        ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground";

  const progressClass =
    state === "done"
      ? "[&>div]:bg-success"
      : state === "active"
        ? "[&>div]:bg-primary"
        : "[&>div]:bg-muted-foreground/30";

  return (
    <div className="relative flex-1 min-w-[220px]">
      {/* Connector line to next phase */}
      {!isLast && (
        <div
          className={`hidden md:block absolute top-5 left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] h-0.5 ${
            state === "done" ? "bg-success/40" : "bg-border"
          }`}
          aria-hidden="true"
        />
      )}

      <div className={`relative rounded-xl border p-4 transition-all ${containerClass}`}>
        <div className="flex items-start gap-3 mb-3">
          <div className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${ringClass}`}>
            {state === "done" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : state === "active" ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background border border-border text-[10px] font-bold flex items-center justify-center text-foreground">
              {step}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {state === "done"
                ? "Concluído"
                : state === "active"
                  ? "Em andamento"
                  : state === "empty"
                    ? "Sem dados no staging"
                    : step === 1
                      ? "Aguardando início"
                      : `Aguardando fase ${step - 1}`}
            </p>
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2 mb-2">
          <div className="flex items-baseline gap-1.5 font-mono">
            <span className={`text-2xl font-bold tracking-tight ${state === "done" ? "text-success" : "text-foreground"}`}>
              {promoted.toLocaleString("pt-BR")}
            </span>
            <span className="text-xs text-muted-foreground">/ {total.toLocaleString("pt-BR")}</span>
          </div>
          <span className={`text-xs font-mono font-semibold ${state === "done" ? "text-success" : "text-muted-foreground"}`}>
            {pct}%
          </span>
        </div>
        <Progress value={pct} className={`h-2.5 ${progressClass}`} />
        {state !== "done" && state !== "empty" && remaining > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            {remaining.toLocaleString("pt-BR")} pendente{remaining > 1 ? "s" : ""}
          </p>
        )}
      </div>
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
  const overallPct = totalStaging > 0 ? Math.min(100, Math.round((totalPromoted / totalStaging) * 100)) : 0;

  // Banner contextual fino — substituído por uma única faixa adaptativa em vez do bloco gigante anterior.
  const banner = (() => {
    if (isLoading) {
      return {
        tone: "muted" as const,
        icon: Loader2,
        spin: true,
        title: "Carregando estado da migração…",
        desc: null as string | null,
        action: null as React.ReactNode,
      };
    }
    if (executionState === "running_stalled") {
      return {
        tone: "warning" as const,
        icon: AlertCircle,
        spin: false,
        title: "Sem atividade recente no job",
        desc: `Job ${job?.id.slice(0, 8) ?? ""}… marcado como em execução, último avanço ${lastActivityLabel}.`,
        action: (
          <Button variant="outline" size="sm" onClick={handleContinue} disabled={continueJob.isPending}>
            {continueJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Retomar agora
          </Button>
        ),
      };
    }
    if (executionState === "running_active") {
      return {
        tone: "info" as const,
        icon: Loader2,
        spin: true,
        title: "Migração rodando agora",
        desc: `${job?.items_processed ?? 0} de ${job?.total_items ?? 0} processados • última atividade ${lastActivityLabel}. Pode fechar a aba.`,
        action: (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending}>
            <X className="w-4 h-4" /> Cancelar
          </Button>
        ),
      };
    }
    if (executionState === "resumable") {
      return {
        tone: "warning" as const,
        icon: AlertCircle,
        spin: false,
        title: "Última migração interrompida",
        desc: `${job?.error_summary ?? "Ainda existem registros pendentes."} • Faltam ${totalPending.toLocaleString("pt-BR")} para alcançar o staging atual.`,
        action: null,
      };
    }
    if (executionState === "completed" && totalPromoted > 0) {
      return {
        tone: "success" as const,
        icon: CheckCircle2,
        spin: false,
        title: "Migração concluída para o staging atual",
        desc: `${totalPromoted.toLocaleString("pt-BR")} registros no CRM • última atividade ${lastActivityLabel}.`,
        action: null,
      };
    }
    if (executionState === "empty") {
      return {
        tone: "muted" as const,
        icon: AlertCircle,
        spin: false,
        title: "Nenhum dado em staging",
        desc: "Importe os dados primeiro na Step 1 da migração.",
        action: null,
      };
    }
    return {
      tone: "primary" as const,
      icon: Rocket,
      spin: false,
      title: "Pronto para iniciar a migração",
      desc: `${totalStaging.toLocaleString("pt-BR")} registros no staging • ${totalPromoted.toLocaleString("pt-BR")} já no CRM.`,
      action: null,
    };
  })();

  const bannerToneClass = {
    muted: "bg-muted/40 border-border text-muted-foreground",
    info: "bg-info/10 border-info/30 text-foreground",
    warning: "bg-warning/10 border-warning/30 text-foreground",
    success: "bg-success/10 border-success/30 text-foreground",
    primary: "bg-primary/10 border-primary/30 text-foreground",
  }[banner.tone];

  const bannerIconClass = {
    muted: "text-muted-foreground",
    info: "text-info",
    warning: "text-warning",
    success: "text-success",
    primary: "text-primary",
  }[banner.tone];

  const headerActions = (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={resetMigrated.isPending || isRunning}
            className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
          >
            {resetMigrated.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eraser className="w-3.5 h-3.5" />
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
              <br /><br />
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

      {isRunning && (
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending} className="h-8">
          <X className="w-3.5 h-3.5" /> Cancelar
        </Button>
      )}

      <Button
        size="sm"
        onClick={isResumable || isStuck ? handleContinue : handleStart}
        disabled={isRunning || start.isPending || continueJob.isPending || nothingToDo}
        className="h-8 gap-1.5 shadow-sm"
      >
        {start.isPending || continueJob.isPending ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {isResumable || isStuck ? "Retomando…" : "Iniciando…"}
          </>
        ) : isRunning ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Em execução…
          </>
        ) : isResumable || isStuck ? (
          <>
            <RefreshCw className="w-3.5 h-3.5" /> Continuar
          </>
        ) : (
          <>
            <Rocket className="w-3.5 h-3.5" /> Iniciar migração
          </>
        )}
      </Button>
    </>
  );

  return (
    <MigrationLayout
      stepLabel="Step 4 / 4"
      title="Migrar dados para o CRM"
      subtitle="Idempotente · roda em background · pode fechar a aba."
      backTo="/admin/migracao-solarmarket/custom-fields"
      backLabel="Voltar para campos customizados"
      actions={headerActions}
    >
      {tenantId && <CustomFieldsMappingSummary tenantId={tenantId} />}

      {/* HERO CARD — overall progress + stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-card to-muted/30 border-border shadow-sm overflow-hidden">
          <CardContent className="p-6 space-y-5">
            {/* Banner contextual fino */}
            <div className={`flex items-start sm:items-center justify-between gap-3 p-3 rounded-lg border ${bannerToneClass}`}>
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <banner.icon className={`w-5 h-5 shrink-0 mt-0.5 sm:mt-0 ${bannerIconClass} ${banner.spin ? "animate-spin" : ""}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{banner.title}</p>
                  {banner.desc && <p className="text-xs text-muted-foreground mt-0.5">{banner.desc}</p>}
                </div>
              </div>
              {banner.action}
            </div>

            {/* Hero progress */}
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Progresso geral</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-bold tracking-tight text-foreground font-mono">
                      {totalPromoted.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-base text-muted-foreground font-mono">
                      / {totalStaging.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm text-muted-foreground">registros migrados</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-bold font-mono ${overallPct === 100 ? "text-success" : "text-primary"}`}>
                    {overallPct}%
                  </span>
                </div>
              </div>
              <Progress value={overallPct} className={`h-3 ${overallPct === 100 ? "[&>div]:bg-success" : "[&>div]:bg-primary"}`} />
            </div>

            {/* Stats compact bar */}
            <div className="grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden">
              <div className="bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">No staging</p>
                <p className="text-xl font-bold tracking-tight text-foreground font-mono mt-0.5">
                  {totalStaging.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Já no CRM</p>
                <p className="text-xl font-bold tracking-tight text-success font-mono mt-0.5">
                  {totalPromoted.toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Pendentes</p>
                <p className={`text-xl font-bold tracking-tight font-mono mt-0.5 ${totalPending > 0 ? "text-warning" : "text-muted-foreground"}`}>
                  {totalPending.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* PHASES TIMELINE */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Fases da migração</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cada fase compara o total no staging com o que já existe no CRM.
              </p>
            </div>
            {isRunning && (
              <span className="text-xs text-muted-foreground font-mono">
                última atividade {lastActivityLabel}
              </span>
            )}
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
                label: "Propostas + custom fields",
                promoted: totals?.propostas.promoted ?? 0,
                total: totals?.propostas.total ?? 0,
              },
            ];

            const firstPendingIdx = phases.findIndex((p) => p.total > 0 && p.promoted < p.total);

            const phaseStates: PhaseState[] = phases.map((p, idx) => {
              if (p.total === 0) return "empty";
              if (p.promoted >= p.total) return "done";
              if (idx === firstPendingIdx && isRunning) return "active";
              return "pending";
            });

            return (
              <div className="flex flex-col md:flex-row gap-3 md:gap-0">
                {phases.map((p, idx) => (
                  <PhaseTimelineItem
                    key={p.step}
                    step={p.step}
                    icon={p.icon}
                    label={p.label}
                    promoted={p.promoted}
                    total={p.total}
                    state={phaseStates[idx]}
                    isLast={idx === phases.length - 1}
                  />
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* JOB TÉCNICO — colapsado por padrão */}
      {job && (
        <Collapsible defaultOpen={isRunning || (job.items_with_errors ?? 0) > 0}>
          <Card className="bg-card border-border shadow-sm">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Detalhes técnicos do job</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel} · lote {job.items_processed}/{job.total_items}
                      {(job.items_with_errors ?? 0) > 0 && (
                        <span className="text-destructive"> · {job.items_with_errors} erros</span>
                      )}
                      {(job.items_with_warnings ?? 0) > 0 && (
                        <span className="text-warning"> · {job.items_with_warnings} avisos</span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 pb-5 px-5 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden">
                  <div className="bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</p>
                    <p className="font-mono text-sm font-bold text-foreground mt-0.5">{statusLabel}</p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Última atividade</p>
                    <p className="font-mono text-sm font-bold text-foreground mt-0.5">{lastActivityLabel}</p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Lote</p>
                    <p className="font-mono text-sm font-bold text-success mt-0.5">
                      {job.items_processed} / {job.total_items}
                    </p>
                  </div>
                  <div className="bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Promovidas (motor)</p>
                    <p className="font-mono text-sm font-bold text-foreground mt-0.5">{job.items_promoted}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => { setLogsFilter("warning"); setLogsOpen(true); }}
                    disabled={!job.id}
                    className="text-left rounded-lg border border-border bg-card p-3 hover:border-warning/50 hover:bg-warning/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center justify-between">
                      Avisos
                      <span className="text-[10px] text-warning underline normal-case">ver</span>
                    </p>
                    <p className="font-mono text-lg font-bold text-warning mt-0.5">{job.items_with_warnings}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLogsFilter("error"); setLogsOpen(true); }}
                    disabled={!job.id}
                    className="text-left rounded-lg border border-border bg-card p-3 hover:border-destructive/50 hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center justify-between">
                      Erros
                      <span className="text-[10px] text-destructive underline normal-case">ver</span>
                    </p>
                    <p className="font-mono text-lg font-bold text-destructive mt-0.5">{job.items_with_errors}</p>
                  </button>
                  <div className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Pulados / bloqueados</p>
                    <p className="font-mono text-lg font-bold text-foreground mt-0.5">
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

                <p className="text-[11px] text-muted-foreground italic">
                  Esta seção mostra o motor interno; o progresso real do CRM está nos cards acima.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <PromotionLogsDialog
        open={logsOpen}
        onOpenChange={setLogsOpen}
        jobId={job?.id ?? null}
        initialFilter={logsFilter}
        warningsCount={job?.items_with_warnings ?? 0}
        errorsCount={job?.items_with_errors ?? 0}
      />
    </MigrationLayout>
  );
}
