import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Pause, Clock, Users, FolderOpen, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
  counts: Record<string, unknown> | null;
  mode: string | null;
}

export function SyncProgressTracker() {
  const [activeSyncLog, setActiveSyncLog] = useState<SyncLog | null>(null);
  const [lastCompletedLog, setLastCompletedLog] = useState<SyncLog | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActiveSyncLog = async () => {
    // Check for running/continuing sync
    const { data: running } = await supabase
      .from("solar_market_sync_logs")
      .select("*")
      .in("status", ["running", "continuing"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (running) {
      setActiveSyncLog(running as unknown as SyncLog);
      return;
    }

    // No active sync - get last completed
    setActiveSyncLog(null);
    const { data: last } = await supabase
      .from("solar_market_sync_logs")
      .select("*")
      .in("status", ["success", "partial", "fail", "cancelled"])
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastCompletedLog(last as unknown as SyncLog | null);
  };

  useEffect(() => {
    fetchActiveSyncLog();

    // Poll every 5s
    intervalRef.current = setInterval(fetchActiveSyncLog, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const counts = (activeSyncLog?.counts || lastCompletedLog?.counts || {}) as Record<string, number>;
  const log = activeSyncLog || lastCompletedLog;

  if (!log) return null;

  const isActive = !!activeSyncLog;
  const totalProjects = counts.total_projects || 0;
  const projectsProcessed = counts.proposals_synced || 0; // proposals == projects processed for sub-resources
  const funnelsProcessed = counts.funnels_synced || 0;
  // Better estimate: funnels_synced is closer to actual projects processed (1 funnel per project)
  const effectiveProcessed = Math.max(funnelsProcessed, projectsProcessed);
  const progressPercent = totalProjects > 0 
    ? Math.min(Math.round((effectiveProcessed / totalProjects) * 100), 100) 
    : 0;

  // Estimate remaining time
  const startedAt = new Date(log.started_at);
  const elapsedMs = Date.now() - startedAt.getTime();
  const elapsedMin = Math.round(elapsedMs / 60000);
  let etaText = "";
  if (isActive && effectiveProcessed > 0 && totalProjects > effectiveProcessed) {
    const msPerProject = elapsedMs / effectiveProcessed;
    const remainingMs = msPerProject * (totalProjects - effectiveProcessed);
    const remainingMin = Math.ceil(remainingMs / 60000);
    etaText = `~${remainingMin} min restantes`;
  }

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Sincronizando...", color: "text-info" },
    continuing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Processando lote...", color: "text-info" },
    success: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Concluído", color: "text-success" },
    partial: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Parcial", color: "text-warning" },
    fail: { icon: <XCircle className="h-4 w-4" />, label: "Falhou", color: "text-destructive" },
    cancelled: { icon: <Pause className="h-4 w-4" />, label: "Cancelado", color: "text-muted-foreground" },
  };

  const status = statusConfig[log.status] || statusConfig.running;

  return (
    <Card className={isActive ? "border-info/30 bg-info/5" : undefined}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={status.color}>{status.icon}</span>
            <span className={`font-medium text-sm ${status.color}`}>{status.label}</span>
            {log.mode && (
              <Badge variant="outline" className="text-[10px]">
                {log.mode === "full" ? "Completa" : "Delta"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {isActive ? `${elapsedMin}min` : formatDistanceToNow(new Date(log.finished_at || log.started_at), { addSuffix: true, locale: ptBR })}
          </div>
        </div>

        {/* Progress bar (only when active and has total) */}
        {isActive && totalProjects > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Fase 2: Sub-recursos ({effectiveProcessed}/{totalProjects} projetos)</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {etaText && (
              <p className="text-[10px] text-muted-foreground text-right">{etaText}</p>
            )}
          </div>
        )}

        {/* Counters */}
        <div className="flex flex-wrap gap-3 text-xs">
          {counts.clients_synced > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-primary" />
              <span>{counts.clients_synced} clientes</span>
            </div>
          )}
          {counts.projects_synced > 0 && (
            <div className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3 text-info" />
              <span>{counts.projects_synced} projetos</span>
            </div>
          )}
          {counts.proposals_synced > 0 && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-success" />
              <span>{counts.proposals_synced} propostas</span>
            </div>
          )}
          {counts.funnels_synced > 0 && (
            <span className="text-muted-foreground">{counts.funnels_synced} funis</span>
          )}
          {counts.custom_fields_synced > 0 && (
            <span className="text-muted-foreground">{counts.custom_fields_synced} campos</span>
          )}
          {counts.leads_linked > 0 && (
            <span className="text-muted-foreground">{counts.leads_linked} leads vinculados</span>
          )}
        </div>

        {/* Error */}
        {log.error && !isActive && (
          <p className="text-xs text-destructive bg-destructive/5 rounded p-2 truncate">
            {log.error}
          </p>
        )}

        {/* Pause info */}
        {isActive && (
          <p className="text-[10px] text-muted-foreground">
            ⏱ Processando {CHUNK_DISPLAY} projetos por lote com pausa entre invocações para evitar timeout.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const CHUNK_DISPLAY = 10;
