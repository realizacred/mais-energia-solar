/**
 * useMigrationJobs — Lista jobs de migração do tenant atual.
 * Polling leve para refletir status em tempo real.
 */
import { useQuery } from "@tanstack/react-query";
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
  return useQuery({
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
    refetchInterval: 8_000,
  });
}
