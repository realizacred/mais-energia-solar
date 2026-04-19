/**
 * useMigrationJobStatus — Status em tempo real de um job (polling 2s enquanto running).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MigrationStatusResponse {
  job: {
    id: string;
    job_type: string;
    status: "pending" | "running" | "completed" | "failed" | "rolled_back";
    started_at: string | null;
    completed_at: string | null;
    error_message: string | null;
    metadata: any;
    created_at: string;
  };
  counters: { pending: number; processing: number; migrated: number; skipped: number; failed: number };
  total: number;
  progress: number;
  errors: Array<{
    entity_type: string;
    sm_entity_id: number;
    error_message: string | null;
    validation_errors: any;
  }>;
  skipped?: Array<{
    entity_type: string;
    sm_entity_id: number;
    error_message: string | null;
    native_entity_id?: string | null;
  }>;
}

export function useMigrationJobStatus(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ["migration-job-status", jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<MigrationStatusResponse> => {
      const { data, error } = await supabase.functions.invoke("migration-status", {
        body: { job_id: jobId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as MigrationStatusResponse;
    },
    refetchInterval: (query) => {
      const s = query.state.data?.job?.status;
      return s === "running" || s === "pending" ? 2_000 : false;
    },
    staleTime: 1_000,
  });
}
