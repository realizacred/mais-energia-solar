/**
 * SmDashboardPanel — Operational dashboard showing real sync/migration progress.
 * Uses useSmSyncProgress (DB queries) + useActiveSmOperation (SSOT) for real-time status.
 */
import { useSmSyncProgress } from "@/hooks/useSmSyncProgress";
import { useActiveSmOperation, useLastCompletedSmOperation } from "@/hooks/useSmOperationRuns";
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
  Activity,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function SmDashboardPanel() {
  const { data: progress } = useSmSyncProgress();
  const { data: activeRun } = useActiveSmOperation();
  const { data: lastRun } = useLastCompletedSmOperation();

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

  // Determine operational status
  const isActive = !!activeRun;
  const isStale = activeRun && (activeRun as any)._stale === true;
  const scanComplete = totalProjects > 0 && projectsRemaining === 0;
  const hasPendingMigration = proposalsPending > 0;

  let statusLabel = "Pronto";
  let statusColor: "success" | "warning" | "primary" | "destructive" | "muted" = "muted";
  let statusIcon = CheckCircle;

  if (isStale) {
    statusLabel = "Possivelmente travado";
    statusColor = "warning";
    statusIcon = AlertTriangle;
  } else if (isActive) {
    const opType = activeRun?.operation_type;
    statusLabel = opType === "sync_proposals" ? "Sincronizando propostas..."
      : opType === "sync_staging" ? "Sincronizando projetos..."
      : opType === "migrate_to_native" ? "Migrando..."
      : "Operação em andamento...";
    statusColor = "primary";
    statusIcon = Loader2;
  } else if (scanComplete && !hasPendingMigration && proposalsMigrated > 0) {
    statusLabel = "Completo";
    statusColor = "success";
    statusIcon = CheckCircle;
  } else if (scanComplete && hasPendingMigration) {
    statusLabel = "Pronto para migrar";
    statusColor = "warning";
    statusIcon = ArrowRightLeft;
  } else if (!scanComplete && totalProjects > 0) {
    statusLabel = "Sync parcial";
    statusColor = "warning";
    statusIcon = Clock;
  }

  const StatusIcon = statusIcon;
  const lastRunInfo = lastRun?.finished_at
    ? formatDistanceToNow(new Date(lastRun.finished_at), { addSuffix: true, locale: ptBR })
    : null;

  return (
    <div className="space-y-3">
      {/* Status Bar */}
      <div className={cn(
        "rounded-lg border px-4 py-3 flex items-center gap-3 flex-wrap",
        statusColor === "primary" && "border-primary/30 bg-primary/5",
        statusColor === "success" && "border-success/20 bg-success/5",
        statusColor === "warning" && "border-warning/30 bg-warning/5",
        statusColor === "destructive" && "border-destructive/20 bg-destructive/5",
        statusColor === "muted" && "border-border bg-muted/30",
      )}>
        <StatusIcon className={cn(
          "h-4 w-4 shrink-0",
          statusColor === "primary" && "text-primary animate-spin",
          statusColor === "success" && "text-success",
          statusColor === "warning" && "text-warning",
          statusColor === "destructive" && "text-destructive",
          statusColor === "muted" && "text-muted-foreground",
        )} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground">{statusLabel}</span>
          {isActive && activeRun?.processed_items != null && activeRun.total_items > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              ({activeRun.processed_items}/{activeRun.total_items} processados)
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {lastRunInfo && (
            <span>Última operação: {lastRunInfo}</span>
          )}
          {lastRun?.error_summary && lastRun.error_summary.includes("time budget") && (
            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
              Parcial por tempo
            </Badge>
          )}
        </div>
      </div>

      {/* Scan Progress Bar (only when not complete) */}
      {totalProjects > 0 && !scanComplete && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Projetos varridos (busca de propostas)</span>
            <span className="font-mono">{projectsScanned} / {totalProjects} ({scanPercent}%)</span>
          </div>
          <Progress value={scanPercent} className="h-2" />
          <p className="text-[11px] text-muted-foreground">
            {projectsRemaining} projetos ainda não verificados
            {!scanComplete && " — continue sincronizando para completar"}
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
          sub={scanComplete ? "Todos verificados" : `${projectsRemaining} restantes`}
          color={scanComplete ? "success" : "info"}
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
