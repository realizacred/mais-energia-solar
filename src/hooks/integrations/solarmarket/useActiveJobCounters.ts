/**
 * useActiveJobCounters — Conta erros/avisos ATIVOS (pós-fix) de um job de
 * promoção SolarMarket, separando do histórico bruto acumulado em
 * `solarmarket_promotion_jobs.items_with_*`.
 *
 * Considera o job mestre + seus sub_jobs (sm-promote) e filtra logs por
 * `created_at >= LAST_FIX_DEPLOY_AT`.
 *
 * RB-04 + RB-MIG-LOG-PARTITION: hook dedicado, idempotente, sem mutar dados.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LAST_FIX_DEPLOY_AT } from "./useSolarmarketLogsPage";

export interface ActiveJobCounters {
  activeErrors: number;
  activeWarnings: number;
  historicalErrors: number;
  historicalWarnings: number;
}

async function countLogs(
  jobIds: string[],
  severity: "error" | "warning",
  mode: "active" | "historical",
): Promise<number> {
  let q = supabase
    .from("solarmarket_promotion_logs")
    .select("id", { count: "exact", head: true })
    .in("job_id", jobIds)
    .eq("severity", severity);

  q = mode === "active"
    ? q.gte("created_at", LAST_FIX_DEPLOY_AT)
    : q.lt("created_at", LAST_FIX_DEPLOY_AT);

  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export function useActiveJobCounters(jobId: string | null | undefined) {
  return useQuery<ActiveJobCounters>({
    queryKey: ["sm-active-job-counters", jobId, LAST_FIX_DEPLOY_AT],
    enabled: !!jobId,
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!jobId) {
        return { activeErrors: 0, activeWarnings: 0, historicalErrors: 0, historicalWarnings: 0 };
      }

      const { data: master } = await supabase
        .from("solarmarket_promotion_jobs")
        .select("metadata")
        .eq("id", jobId)
        .maybeSingle();

      const subIds = Array.isArray(
        (master?.metadata as { sub_jobs?: Array<{ id?: string }> } | null)?.sub_jobs,
      )
        ? ((master!.metadata as { sub_jobs: Array<{ id?: string }> }).sub_jobs
            .map((s) => s?.id)
            .filter((id): id is string => typeof id === "string" && id.length > 0))
        : [];

      const allIds = Array.from(new Set<string>([jobId, ...subIds]));

      const [activeErrors, activeWarnings, historicalErrors, historicalWarnings] =
        await Promise.all([
          countLogs(allIds, "error", "active"),
          countLogs(allIds, "warning", "active"),
          countLogs(allIds, "error", "historical"),
          countLogs(allIds, "warning", "historical"),
        ]);

      return { activeErrors, activeWarnings, historicalErrors, historicalWarnings };
    },
  });
}
