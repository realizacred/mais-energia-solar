/**
 * SmDashboardPanel — SINGLE source of truth for SolarMarket operational status.
 * Combines: DB counts (useSmSyncProgress), SSOT run (useActiveSmOperation),
 * background sync detection (useIsBackgroundSyncActive), and local sync state.
 * 
 * STATE MACHINE:
 *   idle          → no data, nothing running
 *   sync_running  → activeRun with sync type OR local sync running OR bg sync
 *   sync_partial  → scan not complete, nothing running
 *   sync_complete → all projects scanned, nothing running
 *   ready_to_migrate → scan complete, proposals pending migration
 *   migration_running → activeRun with migrate type OR local migration running
 *   migration_complete → scan complete, all proposals migrated
 *   error/stale   → stale heartbeat
 */
import { useSmSyncProgress } from "@/hooks/useSmSyncProgress";
import { useActiveSmOperation, useLastCompletedSmOperation } from "@/hooks/useSmOperationRuns";
import { useExpireStaleSmOperations } from "@/hooks/useExpireStaleSmOperations";
import { useIsBackgroundSyncActive } from "@/hooks/useSolarMarket";
import type { SyncProgress, SyncStageStatus } from "@/hooks/useSolarMarketSync";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  FolderKanban,
  FileText,
  Users,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  XCircle,
  Activity,
  SkipForward,
  Database,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────

type OperationalState =
  | "idle"
  | "sync_running"
  | "sync_partial"
  | "sync_complete"
  | "ready_to_migrate"
  | "migration_running"
  | "migration_complete"
  | "stale";

interface StateConfig {
  label: string;
  sublabel: string;
  color: "primary" | "success" | "warning" | "muted" | "destructive";
  icon: React.ElementType;
  spinning?: boolean;
}

const STATE_CONFIG: Record<OperationalState, StateConfig> = {
  idle:                { label: "Pronto para iniciar", sublabel: "Nenhuma sincronização realizada ainda", color: "muted", icon: Clock },
  sync_running:        { label: "Sincronizando", sublabel: "Importando dados do SolarMarket...", color: "primary", icon: Loader2, spinning: true },
  sync_partial:        { label: "Sync parcial", sublabel: "Execute novamente para completar a varredura", color: "warning", icon: AlertTriangle },
  sync_complete:       { label: "Varredura concluída", sublabel: "Todos os projetos foram verificados", color: "success", icon: CheckCircle },
  ready_to_migrate:    { label: "Pronto para migrar", sublabel: "Propostas aguardando conversão para o CRM", color: "warning", icon: ArrowRightLeft },
  migration_running:   { label: "Migrando propostas", sublabel: "Convertendo dados para o sistema nativo...", color: "primary", icon: Loader2, spinning: true },
  migration_complete:  { label: "Migração concluída", sublabel: "Todos os dados foram convertidos com sucesso", color: "success", icon: CheckCircle },
  stale:               { label: "Operação travada", sublabel: "Sem heartbeat há mais de 5 minutos", color: "destructive", icon: AlertTriangle },
};

// ─── KPI Card ───────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color, progress: progressValue }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: "primary" | "success" | "warning" | "info" | "destructive" | "muted";
  progress?: number;
}) {
  const borderColors: Record<string, string> = {
    primary: "border-l-primary",
    success: "border-l-success",
    warning: "border-l-warning",
    info: "border-l-info",
    destructive: "border-l-destructive",
    muted: "border-l-muted-foreground",
  };
  const bgColors: Record<string, string> = {
    primary: "bg-primary/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    info: "bg-info/10",
    destructive: "bg-destructive/10",
    muted: "bg-muted",
  };
  const iconColors: Record<string, string> = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    info: "text-info",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  };

  return (
    <Card className={cn("border-l-[3px] shadow-sm", borderColors[color])}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bgColors[color])}>
            <Icon className={cn("w-4 h-4", iconColors[color])} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tracking-tight text-foreground leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
        {progressValue !== undefined && (
          <Progress value={progressValue} className="h-1.5" />
        )}
        {sub && <p className="text-[10px] text-muted-foreground leading-snug">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Stage status icon ──────────────────────────────────

function StageIcon({ status }: { status: SyncStageStatus["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
    case "done":
      return <CheckCircle className="h-3.5 w-3.5 text-success" />;
    case "partial":
      return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    case "skipped":
      return <SkipForward className="h-3.5 w-3.5 text-muted-foreground/50" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ─── Active Operation Detail Panel ──────────────────────

function ActiveOperationDetail({
  activeRun,
  localSyncProgress,
  projectsScanned,
  totalProjects,
  totalProposals,
  projectsRemaining,
}: {
  activeRun: any;
  localSyncProgress?: SyncProgress | null;
  projectsScanned: number;
  totalProjects: number;
  totalProposals: number;
  projectsRemaining: number;
}) {
  const heartbeatLabel = activeRun?.heartbeat_at
    ? formatDistanceToNow(new Date(activeRun.heartbeat_at), { addSuffix: true, locale: ptBR })
    : null;

  const opType = activeRun?.operation_type;

  const showLocalStages = localSyncProgress?.isRunning &&
    localSyncProgress.stages.some((s) => s.status !== "pending" && s.status !== "skipped");

  const showProposalScan = opType === "sync_proposals";

  const batchPercent = activeRun && activeRun.total_items > 0
    ? Math.round((activeRun.processed_items / activeRun.total_items) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Activity className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Execução em andamento</span>
            {opType && (
              <p className="text-[11px] text-muted-foreground">
                {opType === "sync_proposals" ? "Varredura de propostas por projeto" :
                 opType === "sync_staging" || opType === "solarmarket_sync" ? "Importação de dados do SolarMarket" :
                 opType === "migrate_to_native" ? "Conversão para sistema nativo" : opType}
              </p>
            )}
            {opType !== "migrate_to_native" && (
              <p className="text-[10px] text-success/80 mt-0.5">
                🖥️ Sincronização no servidor — você pode fechar esta tela com segurança
              </p>
            )}
            {opType === "migrate_to_native" && (
              <p className="text-[10px] text-warning/80 mt-0.5">
                ⚠️ Migração depende do navegador aberto — não feche esta tela
              </p>
            )}
          </div>
        </div>
        {heartbeatLabel && (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
            Heartbeat {heartbeatLabel}
          </Badge>
        )}
      </div>

      {/* Batch progress */}
      {activeRun && activeRun.total_items > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Lote atual</span>
            <span className="font-mono text-foreground font-medium">
              {activeRun.processed_items} / {activeRun.total_items}
              <span className="text-muted-foreground ml-1">({batchPercent}%)</span>
            </span>
          </div>
          <Progress value={batchPercent} className="h-2" />
          <div className="flex items-center gap-3 text-[11px]">
            {activeRun.success_items > 0 && (
              <span className="text-success font-mono">{activeRun.success_items} sucesso</span>
            )}
            {activeRun.error_items > 0 && (
              <span className="text-destructive font-mono">{activeRun.error_items} erros</span>
            )}
            {activeRun.skipped_items > 0 && (
              <span className="text-muted-foreground font-mono">{activeRun.skipped_items} ignorados</span>
            )}
          </div>
        </div>
      )}

      {/* Proposal scan aggregate */}
      {showProposalScan && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border bg-card p-2.5 text-center">
            <p className="text-base font-bold text-foreground">{projectsScanned}</p>
            <p className="text-[10px] text-muted-foreground">Proj. varridos</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2.5 text-center">
            <p className="text-base font-bold text-foreground">{totalProposals}</p>
            <p className="text-[10px] text-muted-foreground">Propostas</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2.5 text-center">
            <p className="text-base font-bold text-warning">{projectsRemaining}</p>
            <p className="text-[10px] text-muted-foreground">Restantes</p>
          </div>
        </div>
      )}

      {/* Local stage-by-stage detail */}
      {showLocalStages && localSyncProgress && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {localSyncProgress.stages
            .filter((s) => s.status !== "skipped")
            .map((stage) => (
              <div
                key={stage.stage}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border p-2 text-[11px]",
                  stage.status === "running" ? "border-primary/30 bg-primary/5" :
                  stage.status === "done" ? "border-success/20 bg-success/5" :
                  stage.status === "partial" ? "border-warning/20 bg-warning/5" :
                  stage.status === "error" ? "border-destructive/20 bg-destructive/5" :
                  "border-border bg-muted/20"
                )}
              >
                <StageIcon status={stage.status} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{stage.label}</p>
                  {stage.status === "running" && (
                    <p className="text-[10px] text-muted-foreground">Processando...</p>
                  )}
                  {stage.status === "done" && (
                    <p className="text-[10px] text-muted-foreground">
                      {stage.fetched} → {stage.upserted}
                    </p>
                  )}
                  {stage.status === "partial" && (
                    <p className="text-[10px] text-warning">
                      {stage.upserted}/{stage.fetched}
                    </p>
                  )}
                  {stage.status === "error" && (
                    <p className="text-[10px] text-destructive truncate">
                      {stage.errorMessage || "Erro"}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── State derivation ───────────────────────────────────

interface SmDashboardPanelProps {
  localSyncRunning?: boolean;
  localMigrationRunning?: boolean;
  localSyncProgress?: SyncProgress | null;
}

function deriveState(params: {
  activeRun: any;
  isStale: boolean;
  isBgSync: boolean;
  localSyncRunning: boolean;
  localMigrationRunning: boolean;
  totalProjects: number;
  projectsScanned: number;
  totalProposals: number;
  proposalsMigrated: number;
}): OperationalState {
  const {
    activeRun, isStale, isBgSync, localSyncRunning, localMigrationRunning,
    totalProjects, projectsScanned, totalProposals, proposalsMigrated,
  } = params;

  if (isStale) return "stale";
  if (activeRun) {
    const opType = activeRun.operation_type;
    if (opType === "migrate_to_native") return "migration_running";
    return "sync_running";
  }
  if (localMigrationRunning) return "migration_running";
  if (localSyncRunning || isBgSync) return "sync_running";
  if (totalProjects === 0) return "idle";

  const scanComplete = projectsScanned >= totalProjects;
  const allMigrated = totalProposals > 0 && proposalsMigrated >= totalProposals;
  const hasPending = totalProposals > 0 && proposalsMigrated < totalProposals;

  if (scanComplete && allMigrated) return "migration_complete";
  if (scanComplete && hasPending) return "ready_to_migrate";
  if (scanComplete && totalProposals === 0) return "sync_complete";
  return "sync_partial";
}

// ─── Component ──────────────────────────────────────────

export function SmDashboardPanel({
  localSyncRunning = false,
  localMigrationRunning = false,
  localSyncProgress = null,
}: SmDashboardPanelProps) {
  const { data: progress } = useSmSyncProgress();
  const { data: activeRun } = useActiveSmOperation();
  const { data: lastRun } = useLastCompletedSmOperation();
  const { data: isBgSyncActive = false } = useIsBackgroundSyncActive();

  if (!progress) return null;

  const {
    totalProjects,
    projectsScanned,
    projectsRemaining,
    totalProposals,
    proposalsMigrated,
    proposalsPending,
    totalClients,
    scanPercent,
  } = progress;

  const isStale = activeRun && (activeRun as any)._stale === true;

  const state = deriveState({
    activeRun,
    isStale: !!isStale,
    isBgSync: isBgSyncActive,
    localSyncRunning,
    localMigrationRunning,
    totalProjects,
    projectsScanned,
    totalProposals,
    proposalsMigrated,
  });

  const config = STATE_CONFIG[state];
  const StatusIcon = config.icon;

  const lastRunInfo = lastRun?.finished_at
    ? formatDistanceToNow(new Date(lastRun.finished_at), { addSuffix: true, locale: ptBR })
    : null;

  let statusSublabel = config.sublabel;
  if (state === "sync_running" && activeRun) {
    const opType = activeRun.operation_type;
    if (opType === "sync_proposals") statusSublabel = "Varrendo propostas em cada projeto...";
    else if (opType === "sync_staging" || opType === "solarmarket_sync") statusSublabel = "Importando clientes, projetos e funis...";
    else statusSublabel = "Operação em andamento...";
  } else if (state === "sync_running" && localSyncRunning && localSyncProgress?.currentStage) {
    const runningStage = localSyncProgress.stages.find((s) => s.status === "running");
    if (runningStage) {
      statusSublabel = `Etapa: ${runningStage.label}`;
    }
  }

  const borderClass = {
    primary: "border-primary/30 bg-primary/5",
    success: "border-success/20 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    muted: "border-border bg-muted/30",
    destructive: "border-destructive/30 bg-destructive/5",
  }[config.color];

  const iconBgClass = {
    primary: "bg-primary/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    muted: "bg-muted",
    destructive: "bg-destructive/10",
  }[config.color];

  const iconClass = cn(
    "h-4 w-4 shrink-0",
    config.color === "primary" && "text-primary",
    config.color === "success" && "text-success",
    config.color === "warning" && "text-warning",
    config.color === "muted" && "text-muted-foreground",
    config.color === "destructive" && "text-destructive",
    config.spinning && "animate-spin",
  );

  const showActiveDetail = state === "sync_running" || state === "migration_running" || state === "stale";

  const migrationPercent = totalProposals > 0 ? Math.round((proposalsMigrated / totalProposals) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── Status Bar ── */}
      <div className={cn("rounded-lg border px-4 py-3 flex items-center gap-3 flex-wrap", borderClass)}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBgClass)}>
          <StatusIcon className={iconClass} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{config.label}</p>
          <p className="text-xs text-muted-foreground">{statusSublabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {lastRunInfo && (
            <Badge variant="outline" className="text-[10px] bg-card border-border">
              Última op: {lastRunInfo}
            </Badge>
          )}
          {lastRun?.error_summary && lastRun.error_summary.includes("time budget") && (
            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
              Parcial por tempo
            </Badge>
          )}
          {lastRun?.status === "failed" && lastRun.error_summary && (
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="h-3 w-3 mr-1" />
              Erro
            </Badge>
          )}
        </div>
      </div>

      {/* ── Active Operation Detail ── */}
      {showActiveDetail && (activeRun || localSyncProgress?.isRunning) && (
        <ActiveOperationDetail
          activeRun={activeRun}
          localSyncProgress={localSyncProgress}
          projectsScanned={projectsScanned}
          totalProjects={totalProjects}
          totalProposals={totalProposals}
          projectsRemaining={projectsRemaining}
        />
      )}

      {/* ── Server-side info microcopy ── */}
      {state === "sync_running" && (
        <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2 flex items-center gap-2 text-xs text-success">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Sincronização no servidor ativa — você pode fechar esta tela. O progresso continua automaticamente.</span>
        </div>
      )}
      {state === "migration_running" && (
        <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Migração em andamento no navegador — mantenha esta tela aberta. Se fechar, o progresso salvo será retomado na próxima execução manual.</span>
        </div>
      )}

      {/* ── Staging vs Conversion sections ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Staging — Dados importados */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-info/10 flex items-center justify-center">
              <Database className="h-3.5 w-3.5 text-info" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Dados importados</h3>
            <span className="text-[10px] text-muted-foreground">(staging)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <KpiCard
              icon={Users}
              label="Clientes"
              value={totalClients}
              color="primary"
              sub={totalClients > 0 ? "Importados do SolarMarket" : "Sincronize para importar"}
            />
            <KpiCard
              icon={FolderKanban}
              label="Projetos verificados"
              value={`${projectsScanned} / ${totalProjects}`}
              color={projectsRemaining === 0 && totalProjects > 0 ? "success" : "info"}
              progress={scanPercent}
              sub={projectsRemaining === 0 && totalProjects > 0
                ? "Todos os projetos verificados"
                : `${projectsRemaining} restantes para varrer`}
            />
            <KpiCard
              icon={FileText}
              label="Propostas encontradas"
              value={totalProposals}
              color={totalProposals > 0 ? "success" : "muted"}
              sub={totalProposals > 0
                ? `Em ${projectsScanned} projetos varridos`
                : "Nenhuma proposta encontrada ainda"}
            />
          </div>
        </div>

        {/* Conversion — Migração para CRM */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-warning/10 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-warning" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Conversão para CRM</h3>
            <span className="text-[10px] text-muted-foreground">(migração)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <KpiCard
              icon={ArrowRightLeft}
              label="Migradas"
              value={proposalsMigrated}
              color={proposalsMigrated > 0 ? "success" : "muted"}
              progress={migrationPercent}
              sub={proposalsMigrated > 0
                ? `${migrationPercent}% de ${totalProposals} propostas`
                : "Nenhuma proposta migrada ainda"}
            />
            <KpiCard
              icon={Clock}
              label="Pendentes"
              value={proposalsPending}
              color={proposalsPending > 0 ? "warning" : "success"}
              sub={proposalsPending > 0
                ? "Aguardando conversão para o CRM"
                : totalProposals > 0
                  ? "Todas as propostas foram migradas"
                  : "Sem propostas para migrar"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
