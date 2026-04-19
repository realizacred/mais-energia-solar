import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Static registry of known cron jobs */
export interface CronJobDefinition {
  name: string;
  label: string;
  intervalMinutes: number;
  description: string;
}

export const CRON_JOBS: CronJobDefinition[] = [
  { name: "monitor-alert-engine", label: "Motor de Alertas", intervalMinutes: 5, description: "Verifica alertas de usinas solares" },
  { name: "process-sla-alerts", label: "Alertas SLA", intervalMinutes: 2, description: "Processa alertas de SLA de atendimento" },
  { name: "pipeline-automations", label: "Automações Pipeline", intervalMinutes: 5, description: "Executa automações do pipeline comercial" },
  { name: "meta-ads-sync", label: "Meta Ads Sync", intervalMinutes: 1440, description: "Sincroniza leads e campanhas do Meta Ads (diário 06:00 BRT)" },
  { name: "sync-tarifas-aneel", label: "Tarifas ANEEL", intervalMinutes: 1440, description: "Sincroniza tarifas da ANEEL (diário)" },
  { name: "integration-health-check", label: "Health Check Integrações", intervalMinutes: 15, description: "Verifica saúde das integrações externas" },
  { name: "monitoring-sync", label: "Monitoramento Sync", intervalMinutes: 15, description: "Sincroniza dados de monitoramento solar" },
  { name: "retry-failed-calendar-sync", label: "Retry Calendar Sync", intervalMinutes: 5, description: "Retenta sincronizações de calendário falhadas" },
  { name: "wa-bg-worker", label: "WA Background Worker", intervalMinutes: 1, description: "Worker de background do WhatsApp" },
  { name: "process-wa-outbox", label: "WA Outbox", intervalMinutes: 1, description: "Processa fila de envio de mensagens WhatsApp" },
  { name: "process-wa-followups", label: "WA Follow-ups", intervalMinutes: 2, description: "Processa follow-ups automáticos do WhatsApp" },
  { name: "sync-wa-profile-pictures", label: "WA Fotos Perfil", intervalMinutes: 60, description: "Sincroniza fotos de perfil do WhatsApp" },
  { name: "wa-instance-watchdog", label: "WA Watchdog", intervalMinutes: 5, description: "Monitora instâncias WhatsApp" },
  { name: "check-energy-alerts-hourly", label: "Alertas Energia", intervalMinutes: 60, description: "Varredura proativa de alertas energéticos (medidores, faturas, geração, GD)" },
  { name: "verificar-vencimentos-diario", label: "Lembretes Vencimento", intervalMinutes: 1440, description: "Envia lembretes de vencimento de recebimentos via WhatsApp (diário 08:00 BRT)" },
];

export type CronStatus = "success" | "running" | "failed" | "overdue" | "unknown";

export interface CronJobStatus {
  definition: CronJobDefinition;
  lastExecution: {
    started_at: string;
    finished_at: string | null;
    status: string;
    duration_ms: number | null;
    error_message: string | null;
  } | null;
  computedStatus: CronStatus;
}

function computeStatus(
  def: CronJobDefinition,
  last: CronJobStatus["lastExecution"]
): CronStatus {
  if (!last) return "unknown";
  if (last.status === "running") return "running";
  if (last.status === "failed") return "failed";

  // Check if overdue: last success > 2x interval ago
  const lastTime = new Date(last.finished_at || last.started_at).getTime();
  const overdueThreshold = def.intervalMinutes * 2 * 60 * 1000;
  if (Date.now() - lastTime > overdueThreshold) return "overdue";

  return "success";
}

export function useCronJobs() {
  return useQuery({
    queryKey: ["cron-jobs-status"],
    queryFn: async (): Promise<CronJobStatus[]> => {
      // Fetch latest execution per job using a lateral join approach
      // Since we can't do lateral joins via PostgREST, fetch recent logs and group client-side
      const { data, error } = await supabase
        .from("cron_execution_logs")
        .select("job_name, started_at, finished_at, status, duration_ms, error_message")
        .order("started_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Group by job_name, take the latest
      const latestByJob = new Map<string, CronJobStatus["lastExecution"]>();
      for (const row of data || []) {
        if (!latestByJob.has(row.job_name)) {
          latestByJob.set(row.job_name, {
            started_at: row.started_at,
            finished_at: row.finished_at,
            status: row.status,
            duration_ms: row.duration_ms,
            error_message: row.error_message,
          });
        }
      }

      return CRON_JOBS.map((def) => {
        const last = latestByJob.get(def.name) || null;
        return {
          definition: def,
          lastExecution: last,
          computedStatus: computeStatus(def, last),
        };
      });
    },
    staleTime: 30 * 1000, // 30s — real-time-ish data
    refetchInterval: 60 * 1000, // auto-refresh every minute
  });
}
