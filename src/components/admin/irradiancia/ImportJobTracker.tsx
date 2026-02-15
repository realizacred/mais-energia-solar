/**
 * ImportJobTracker — displays running/completed import jobs with status polling and log viewer.
 * Pure UI component — all data comes from backend via solar-datasets-api service.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, CheckCircle2, XCircle, Clock, ChevronDown, FileText, AlertTriangle, Info,
} from "lucide-react";
import {
  type ImportJob,
  type ImportJobLog,
  type ImportJobStatus,
  getImportJobStatus,
  getImportJobLogs,
  getBackoffDelay,
} from "@/services/solar-datasets-api";

// ─── Status config ───────────────────────────────────────────

const STATUS_CONFIG: Record<ImportJobStatus, { icon: React.ElementType; label: string; description: string; className: string }> = {
  queued: {
    icon: Clock,
    label: "Na fila",
    description: "Aguardando início do processamento…",
    className: "bg-muted text-muted-foreground border-border",
  },
  running: {
    icon: Loader2,
    label: "Processando",
    description: "Importação em andamento. Os dados estão sendo buscados e gravados no banco.",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  success: {
    icon: CheckCircle2,
    label: "Concluído",
    description: "Importação finalizada com sucesso! Dados disponíveis para uso.",
    className: "bg-success/10 text-success border-success/30",
  },
  failed: {
    icon: XCircle,
    label: "Falhou",
    description: "A importação encontrou um erro. Verifique os logs para detalhes.",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

// ─── Component ───────────────────────────────────────────────

interface ImportJobTrackerProps {
  jobs: ImportJob[];
  onJobUpdate: (updatedJob: ImportJob) => void;
}

export function ImportJobTracker({ jobs, onJobUpdate }: ImportJobTrackerProps) {
  if (jobs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Jobs de Importação
          <Badge variant="outline" className="text-[10px] ml-auto">{jobs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.map((job) => (
          <JobRow key={job.job_id} job={job} onJobUpdate={onJobUpdate} />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Job Row with exponential backoff polling ────────────────

function JobRow({ job, onJobUpdate }: { job: ImportJob; onJobUpdate: (j: ImportJob) => void }) {
  const [logs, setLogs] = useState<ImportJobLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const isTerminal = job.status === "success" || job.status === "failed";
  const config = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.queued;
  const Icon = config.icon;

  // Exponential backoff polling: 3s → 5s → 8s (clamped)
  useEffect(() => {
    if (isTerminal) {
      attemptRef.current = 0;
      return;
    }

    const schedulePoll = () => {
      const delay = getBackoffDelay(attemptRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const updated = await getImportJobStatus(job.job_id);
          onJobUpdate(updated);
          attemptRef.current = Math.min(attemptRef.current + 1, 10);
        } catch {
          attemptRef.current = Math.min(attemptRef.current + 1, 10);
        }
        schedulePoll();
      }, delay);
    };

    schedulePoll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [job.job_id, isTerminal, onJobUpdate]);

  // Load logs on expand
  const handleToggleLogs = useCallback(async () => {
    const willOpen = !logsOpen;
    setLogsOpen(willOpen);
    if (willOpen && logs.length === 0) {
      setLogsLoading(true);
      setLogsError("");
      try {
        const data = await getImportJobLogs(job.job_id);
        setLogs(data);
      } catch (e: any) {
        setLogsError(e.message ?? "Erro ao carregar logs");
      } finally {
        setLogsLoading(false);
      }
    }
  }, [logsOpen, logs.length, job.job_id]);

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const elapsed = job.started_at
    ? ((job.finished_at ? new Date(job.finished_at).getTime() : Date.now()) - new Date(job.started_at).getTime()) / 1000
    : null;

  const formatElapsed = (secs: number) => {
    if (secs < 60) return `${Math.round(secs)}s`;
    const mins = Math.floor(secs / 60);
    const remainSecs = Math.round(secs % 60);
    return `${mins}m ${remainSecs}s`;
  };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {/* Status banner with description */}
      <div className={`px-3 py-2 border-b border-border/30 ${
        job.status === "running" ? "bg-primary/5" :
        job.status === "success" ? "bg-success/5" :
        job.status === "failed" ? "bg-destructive/5" :
        "bg-muted/30"
      }`}>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${
            job.status === "running" ? "animate-spin text-primary" :
            job.status === "success" ? "text-success" :
            job.status === "failed" ? "text-destructive" :
            "text-muted-foreground"
          }`} />
          <span className={`text-xs font-semibold ${
            job.status === "running" ? "text-primary" :
            job.status === "success" ? "text-success" :
            job.status === "failed" ? "text-destructive" :
            "text-muted-foreground"
          }`}>
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground">—</span>
          <span className="text-[10px] text-muted-foreground">{config.description}</span>
        </div>
      </div>

      {/* Main row */}
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted-foreground truncate" title={job.job_id}>
            {job.job_id.substring(0, 8)}…
          </span>
          <Badge variant="outline" className="text-[10px]">{job.dataset_key}</Badge>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
          {job.row_count != null && (
            <span className="font-medium">{job.row_count.toLocaleString()} pontos</span>
          )}
          {elapsed != null && (
            <span title="Tempo decorrido">⏱ {formatElapsed(elapsed)}</span>
          )}
          <span title="Início">{formatTimestamp(job.started_at || job.created_at)}</span>
          {job.finished_at && <span title="Fim">→ {formatTimestamp(job.finished_at)}</span>}
        </div>
      </div>

      {/* Timeline steps */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1 text-[10px]">
          <StepDot done label="Criado" />
          <StepLine done={job.status !== "queued"} />
          <StepDot done={job.status !== "queued"} active={job.status === "running"} label="Processando" />
          <StepLine done={isTerminal} />
          <StepDot
            done={isTerminal}
            error={job.status === "failed"}
            label={job.status === "failed" ? "Erro" : "Concluído"}
          />
        </div>
      </div>

      {/* Error message */}
      {job.error_message && (
        <div className="px-3 pb-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive">{job.error_message}</p>
          </div>
        </div>
      )}

      {/* Logs collapsible */}
      <Collapsible open={logsOpen} onOpenChange={handleToggleLogs}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between rounded-none border-t border-border/30 h-8 text-[10px] text-muted-foreground px-3"
          >
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> Logs
            </span>
            <ChevronDown className={`h-3 w-3 transition-transform ${logsOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/30 bg-muted/30">
            {logsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : logsError ? (
              <div className="p-3 text-xs text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {logsError}
              </div>
            ) : logs.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground italic">Nenhum log disponível.</p>
            ) : (
              <ScrollArea className="max-h-48">
                <div className="p-2 space-y-0.5 font-mono text-[10px]">
                  {logs.map((log) => (
                    <div key={log.id} className="flex gap-2">
                      <span className="text-muted-foreground/60 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString("pt-BR")}
                      </span>
                      <span className={`uppercase w-10 shrink-0 ${LOG_LEVEL_COLORS[log.level] ?? ""}`}>
                        [{log.level}]
                      </span>
                      <span className={LOG_LEVEL_COLORS[log.level] ?? "text-foreground"}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Timeline Step Components ────────────────────────────────

function StepDot({ done, active, error, label }: { done: boolean; active?: boolean; error?: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`h-2.5 w-2.5 rounded-full border-2 ${
        error ? "border-destructive bg-destructive" :
        done ? "border-success bg-success" :
        active ? "border-primary bg-primary animate-pulse" :
        "border-border bg-background"
      }`} />
      <span className={`text-[9px] ${
        error ? "text-destructive" :
        done ? "text-success" :
        active ? "text-primary font-medium" :
        "text-muted-foreground"
      }`}>{label}</span>
    </div>
  );
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 min-w-6 ${done ? "bg-success" : "bg-border"}`} />
  );
}
