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
  color: "primary" | "success" | "warning" | "muted" | "destructive";
  icon: React.ElementType;
  spinning?: boolean;
}

const STATE_CONFIG: Record<OperationalState, StateConfig> = {
  idle:                { label: "Aguardando sincronização",         color: "muted",   icon: Clock },
  sync_running:        { label: "Sincronizando...",                 color: "primary",  icon: Loader2, spinning: true },
  sync_partial:        { label: "Sync parcial — continue para completar", color: "warning", icon: Clock },
  sync_complete:       { label: "Sync completo",                    color: "success",  icon: CheckCircle },
  ready_to_migrate:    { label: "Pronto para migrar",               color: "warning",  icon: ArrowRightLeft },
  migration_running:   { label: "Migrando propostas...",            color: "primary",  icon: Loader2, spinning: true },
  migration_complete:  { label: "Migração concluída",               color: "success",  icon: CheckCircle },
  stale:               { label: "Operação possivelmente travada",   color: "warning",  icon: AlertTriangle },
};

// ─── KPI Card ───────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: "primary" | "success" | "warning" | "info" | "destructive" | "muted";
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
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", bgColors[color])}>
          <Icon className={cn("w-4.5 h-4.5", iconColors[color])} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
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

  // Show local stage-by-stage detail for sync_staging
  const showLocalStages = localSyncProgress?.isRunning &&
    localSyncProgress.stages.some((s) => s.status !== "pending" && s.status !== "skipped");

  // Show proposal scan detail for sync_proposals
  const showProposalScan = opType === "sync_proposals";

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Execução atual</span>
          {opType && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {opType === "sync_proposals" ? "Varredura de propostas" :
               opType === "sync_staging" || opType === "solarmarket_sync" ? "Sync de staging" :
               opType === "migrate_to_native" ? "Migração" : opType}
            </Badge>
          )}
        </div>
        {heartbeatLabel && (
          <span className="text-[10px] text-muted-foreground">
            Heartbeat: {heartbeatLabel}
          </span>
        )}
      </div>

      {/* SSOT run progress */}
      {activeRun && activeRun.total_items > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Processados neste lote</span>
            <span className="font-mono">{activeRun.processed_items} / {activeRun.total_items}</span>
          </div>
          <Progress value={Math.round((activeRun.processed_items / activeRun.total_items) * 100)} className="h-1.5" />
          {activeRun.error_items > 0 && (
            <span className="text-[10px] text-destructive">{activeRun.error_items} erros</span>
          )}
        </div>
      )}

      {/* Proposal scan — show aggregate progress */}
      {showProposalScan && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border bg-card p-2 text-center">
            <p className="text-sm font-bold text-foreground">{projectsScanned}</p>
            <p className="text-[10px] text-muted-foreground">Proj. varridos</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2 text-center">
            <p className="text-sm font-bold text-foreground">{totalProposals}</p>
            <p className="text-[10px] text-muted-foreground">Propostas encontradas</p>
          </div>
          <div className="rounded-md border border-border bg-card p-2 text-center">
            <p className="text-sm font-bold text-foreground">{projectsRemaining}</p>
            <p className="text-[10px] text-muted-foreground">Restantes</p>
          </div>
        </div>
      )}

      {/* Local stage-by-stage detail for sync_staging */}
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

  // Stale takes priority
  if (isStale) return "stale";

  // Active operation from SSOT
  if (activeRun) {
    const opType = activeRun.operation_type;
    if (opType === "migrate_to_native") return "migration_running";
    return "sync_running";
  }

  // Local state signals
  if (localMigrationRunning) return "migration_running";
  if (localSyncRunning || isBgSync) return "sync_running";

  // No active operation — derive from data
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

  // Active run progress detail
  const activeRunDetail = activeRun && activeRun.total_items > 0
    ? `${activeRun.processed_items}/${activeRun.total_items} processados`
    : null;

  // Sub-status for sync_running: show which type
  let statusSublabel = "";
  if (state === "sync_running" && activeRun) {
    const opType = activeRun.operation_type;
    if (opType === "sync_proposals") statusSublabel = "Buscando propostas nos projetos...";
    else if (opType === "sync_staging" || opType === "solarmarket_sync") statusSublabel = "Sincronizando projetos...";
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

  const iconClass = cn(
    "h-4 w-4 shrink-0",
    config.color === "primary" && "text-primary",
    config.color === "success" && "text-success",
    config.color === "warning" && "text-warning",
    config.color === "muted" && "text-muted-foreground",
    config.color === "destructive" && "text-destructive",
    config.spinning && "animate-spin",
  );

  // Show active operation detail when something is running
  const showActiveDetail = state === "sync_running" || state === "migration_running" || state === "stale";

  return (
    <div className="space-y-3">
      {/* Unified Status Bar */}
      <div className={cn("rounded-lg border px-4 py-3 flex items-center gap-3 flex-wrap", borderClass)}>
        <StatusIcon className={iconClass} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">{config.label}</span>
          {statusSublabel && (
            <span className="text-xs text-muted-foreground ml-2">{statusSublabel}</span>
          )}
          {activeRunDetail && (
            <span className="text-xs text-muted-foreground ml-2">({activeRunDetail})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastRunInfo && <span>Última op: {lastRunInfo}</span>}
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

      {/* Active Operation Detail — visible only when operation is active */}
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

      {/* Scan Progress Bar (only when scan incomplete and we have projects) */}
      {totalProjects > 0 && projectsRemaining > 0 && !showActiveDetail && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Projetos varridos (busca de propostas)</span>
            <span className="font-mono">{projectsScanned} / {totalProjects} ({scanPercent}%)</span>
          </div>
          <Progress value={scanPercent} className="h-2" />
          <p className="text-[11px] text-muted-foreground">
            {projectsRemaining} projetos ainda não verificados
            {state !== "sync_running" && " — clique em Sincronizar Tudo para continuar"}
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <KpiCard
          icon={Users}
          label="Clientes"
          value={totalClients}
          color="primary"
        />
        <KpiCard
          icon={FolderKanban}
          label="Projetos varridos"
          value={`${projectsScanned} / ${totalProjects}`}
          sub={projectsRemaining === 0 && totalProjects > 0 ? "Todos verificados" : `${projectsRemaining} restantes`}
          color={projectsRemaining === 0 && totalProjects > 0 ? "success" : "info"}
        />
        <KpiCard
          icon={FileText}
          label="Propostas encontradas"
          value={totalProposals}
          sub={totalProposals > 0 ? `De ${projectsScanned} projetos` : "Nenhuma ainda"}
          color={totalProposals > 0 ? "success" : "muted"}
        />
        <KpiCard
          icon={ArrowRightLeft}
          label="Migração"
          value={proposalsMigrated > 0 ? `${proposalsMigrated} / ${totalProposals}` : proposalsPending > 0 ? `${proposalsPending} pendentes` : "—"}
          sub={proposalsMigrated > 0 ? `${proposalsPending} pendentes` : undefined}
          color={proposalsPending > 0 ? "warning" : proposalsMigrated > 0 ? "success" : "muted"}
        />
      </div>
    </div>
  );
}
