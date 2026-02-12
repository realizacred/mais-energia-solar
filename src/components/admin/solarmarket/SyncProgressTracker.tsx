import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Pause, Clock, Users, FolderOpen, FileText, Play, Timer } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHUNK_SIZE = 10;

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
  const funnelsProcessed = counts.funnels_synced || 0;
  const proposalsProcessed = counts.proposals_synced || 0;
  const effectiveProcessed = Math.max(funnelsProcessed, proposalsProcessed);
  const progressPercent = totalProjects > 0
    ? Math.min(Math.round((effectiveProcessed / totalProjects) * 100), 100)
    : 0;

  // Time calculations
  const startedAt = new Date(log.started_at);
  const elapsedMs = Date.now() - startedAt.getTime();
  const elapsedMin = Math.round(elapsedMs / 60000);

  let etaDate: Date | null = null;
  let etaText = "";
  if (isActive && effectiveProcessed > 0 && totalProjects > effectiveProcessed) {
    const msPerProject = elapsedMs / effectiveProcessed;
    const remainingMs = msPerProject * (totalProjects - effectiveProcessed);
    const remainingMin = Math.ceil(remainingMs / 60000);
    etaDate = new Date(Date.now() + remainingMs);
    etaText = `~${remainingMin} min`;
  }

  // Current chunk info
  const currentChunk = Math.floor(effectiveProcessed / CHUNK_SIZE) + 1;
  const totalChunks = totalProjects > 0 ? Math.ceil(totalProjects / CHUNK_SIZE) : 0;

  const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Sincronizando...", color: "text-info" },
    continuing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, label: "Processando lote...", color: "text-info" },
    success: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Concluído", color: "text-success" },
    partial: { icon: <CheckCircle2 className="h-4 w-4" />, label: "Parcial (com erros)", color: "text-warning" },
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
            {isActive && totalChunks > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                Lote {currentChunk}/{totalChunks}
              </Badge>
            )}
          </div>
        </div>

        {/* Timeline: Início, Duração, Fim previsto */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/50 border">
          {/* Início */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <Play className="h-3 w-3" />
              Início
            </div>
            <p className="text-xs font-medium">
              {format(startedAt, "HH:mm:ss", { locale: ptBR })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {format(startedAt, "dd/MM", { locale: ptBR })}
            </p>
          </div>

          {/* Duração / Pausa */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <Clock className="h-3 w-3" />
              {isActive ? "Decorrido" : "Duração"}
            </div>
            <p className="text-xs font-medium">
              {isActive
                ? `${elapsedMin} min`
                : log.finished_at
                  ? `${Math.round((new Date(log.finished_at).getTime() - startedAt.getTime()) / 60000)} min`
                  : "--"
              }
            </p>
            {isActive && (
              <p className="text-[10px] text-info">
                ⏸ 3s pausa/lote
              </p>
            )}
          </div>

          {/* Fim previsto / Fim real */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
              <Timer className="h-3 w-3" />
              {isActive ? "Fim previsto" : "Finalizado"}
            </div>
            {isActive ? (
              etaDate ? (
                <>
                  <p className="text-xs font-medium text-info">
                    ~{format(etaDate, "HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{etaText}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Calculando...</p>
              )
            ) : log.finished_at ? (
              <>
                <p className="text-xs font-medium">
                  {format(new Date(log.finished_at), "HH:mm:ss", { locale: ptBR })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(log.finished_at), { addSuffix: true, locale: ptBR })}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">--</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalProjects > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Sub-recursos: {effectiveProcessed}/{totalProjects} projetos</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
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
          {proposalsProcessed > 0 && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-success" />
              <span>{proposalsProcessed} propostas</span>
            </div>
          )}
          {funnelsProcessed > 0 && (
            <span className="text-muted-foreground">{funnelsProcessed} funis</span>
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
      </CardContent>
    </Card>
  );
}
