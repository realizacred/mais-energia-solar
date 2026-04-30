/**
 * useIntegrationJobsPage — Adapter fino (RB-76).
 * Reaproveita: integration_jobs + integration_sync_runs (read-only).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationJobRow {
  id: string;
  provider: string;
  job_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  source: "jobs" | "sync_runs";
  items_processed?: number | null;
}

export function useIntegrationJobsPage() {
  return useQuery({
    queryKey: ["integrations", "connections", "jobs"],
    queryFn: async (): Promise<IntegrationJobRow[]> => {
      const [jobsRes, runsRes] = await Promise.all([
        supabase
          .from("integration_jobs")
          .select("id, provider_id, job_type, status, started_at, finished_at, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("integration_sync_runs")
          .select("id, provider, sync_type, status, started_at, finished_at, items_processed")
          .order("started_at", { ascending: false })
          .limit(100),
      ]);

      const jobs: IntegrationJobRow[] = (jobsRes.data ?? []).map((r: any) => ({
        id: r.id,
        provider: r.provider_id,
        job_type: r.job_type,
        status: r.status,
        started_at: r.started_at,
        finished_at: r.finished_at,
        created_at: r.created_at,
        source: "jobs",
      }));

      const runs: IntegrationJobRow[] = (runsRes.data ?? []).map((r: any) => ({
        id: r.id,
        provider: r.provider,
        job_type: r.sync_type,
        status: r.status,
        started_at: r.started_at,
        finished_at: r.finished_at,
        created_at: r.started_at,
        source: "sync_runs",
        items_processed: r.items_processed,
      }));

      return [...jobs, ...runs].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      );
    },
    staleTime: 1000 * 30,
  });
}
