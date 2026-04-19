/**
 * useMigrationJobs — Lista jobs de migração do tenant atual.
 * Polling leve para refletir status em tempo real.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MigrationJobRow {
  id: string;
  tenant_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed" | "rolled_back";
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
}

export function useMigrationJobs() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["migration-jobs"],
    queryFn: async (): Promise<MigrationJobRow[]> => {
      const { data, error } = await (supabase as any)
        .from("migration_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as MigrationJobRow[];
    },
    staleTime: 5_000,
    refetchInterval: (q) => {
      const jobs = (q.state.data ?? []) as MigrationJobRow[];
      return jobs.some((job) => job.status === "pending" || job.status === "running") ? 2_000 : 8_000;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("migration-jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "migration_jobs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["migration-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["migration-job-status"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "migration_records" }, () => {
        queryClient.invalidateQueries({ queryKey: ["migration-jobs"] });
        queryClient.invalidateQueries({ queryKey: ["migration-job-status"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
