/**
 * useSmOperationRuns — Hook to query the SSOT table for SM operation state.
 * §16: Query in hook. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmOperationRun {
  id: string;
  tenant_id: string;
  source: string;
  operation_type: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  total_items: number;
  processed_items: number;
  success_items: number;
  error_items: number;
  skipped_items: number;
  error_summary: string | null;
  created_at: string;
}

const STALE_HEARTBEAT_MS = 15 * 60 * 1000; // 15 min

/** Returns the active SM operation (running/queued), or null */
export function useActiveSmOperation() {
  return useQuery({
    queryKey: ["sm-operation-runs", "active-detail"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_operation_runs")
        .select("id, operation_type, status, started_at, finished_at, heartbeat_at, total_items, processed_items, success_items, error_items, skipped_items, error_summary, created_at")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const run = data[0] as SmOperationRun;

      // Check for stale run (heartbeat > 15min ago)
      if (run.heartbeat_at) {
        const heartbeatAge = Date.now() - new Date(run.heartbeat_at).getTime();
        if (heartbeatAge > STALE_HEARTBEAT_MS) {
          return { ...run, _stale: true } as SmOperationRun & { _stale?: boolean };
        }
      }

      return { ...run, _stale: false } as SmOperationRun & { _stale?: boolean };
    },
    staleTime: 1000 * 5,
    refetchInterval: 1000 * 10, // poll every 10s
  });
}

/** Returns true if any SM operation is currently running */
export function useHasActiveSmOperation() {
  return useQuery({
    queryKey: ["sm-operation-runs", "active"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_operation_runs")
        .select("id, operation_type, status, started_at, heartbeat_at")
        .in("status", ["queued", "running"])
        .limit(1);

      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });
}

/** Returns recent SM operation runs for history display */
export function useSmOperationHistory(limit = 20) {
  return useQuery({
    queryKey: ["sm-operation-runs", "history", limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_operation_runs")
        .select("id, operation_type, status, started_at, finished_at, total_items, processed_items, success_items, error_items, skipped_items, error_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as SmOperationRun[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Returns the most recent completed/failed run for context */
export function useLastCompletedSmOperation() {
  return useQuery({
    queryKey: ["sm-operation-runs", "last-completed"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_operation_runs")
        .select("id, operation_type, status, started_at, finished_at, total_items, processed_items, success_items, error_items, skipped_items, error_summary, created_at")
        .in("status", ["completed", "failed"])
        .order("finished_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      return (data?.[0] ?? null) as SmOperationRun | null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
