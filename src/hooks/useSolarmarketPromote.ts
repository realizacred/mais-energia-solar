/**
 * useSolarmarketPromote — Hook dedicado para a Fase 2 (Promoção staging → CRM).
 *
 * Centraliza chamadas à edge `sm-promote` e leitura das tabelas:
 *   - solarmarket_promotion_jobs
 *   - solarmarket_promotion_logs
 *
 * Governança:
 *   - RB-04: queries só em hook
 *   - RB-05: staleTime obrigatório
 *   - RB-17/AP-23: sem console.log ativo
 *   - DA-39: invalidações via queryClient (sem reload)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PromotionJob = {
  id: string;
  tenant_id: string;
  triggered_by: string | null;
  trigger_source: string;
  job_type: string;
  status: string;
  filters: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  total_items: number;
  items_processed: number;
  items_promoted: number;
  items_skipped: number;
  items_with_warnings: number;
  items_with_errors: number;
  items_blocked: number;
  error_summary: unknown;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PromotionLog = {
  id: string;
  job_id: string;
  tenant_id: string;
  severity: "info" | "warning" | "error" | string;
  step: string;
  status: string;
  message: string | null;
  source_entity_type: string | null;
  source_entity_id: string | null;
  canonical_entity_type: string | null;
  canonical_entity_id: string | null;
  error_code: string | null;
  error_origin: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const JOBS_KEY = ["sm-promote", "jobs"] as const;
const LOGS_KEY = (jobId: string | null) => ["sm-promote", "logs", jobId] as const;

async function invokePromote<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("sm-promote", { body });
  if (error) throw new Error(error.message || "Falha ao chamar sm-promote");
  if (data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok === false) {
    const msg = (data as { error?: string }).error ?? "Erro desconhecido em sm-promote";
    throw new Error(msg);
  }
  return data as T;
}

export function useSolarmarketPromote() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: JOBS_KEY,
    staleTime: 1000 * 30, // 30s — dados operacionais
    queryFn: async (): Promise<PromotionJob[]> => {
      const { data, error } = await supabase
        .from("solarmarket_promotion_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PromotionJob[];
    },
    refetchInterval: (query) => {
      const list = (query.state.data as PromotionJob[] | undefined) ?? [];
      return list.some((j) => j.status === "pending" || j.status === "running") ? 4000 : false;
    },
  });

  const promoteAll = useMutation({
    mutationFn: async (params: { batch_limit: number; dry_run: boolean }) => {
      return invokePromote<{
        ok: boolean;
        job_id: string;
        status: string;
        counters?: Record<string, number>;
        candidates?: number;
        dry_run?: boolean;
      }>({
        action: "promote-all",
        payload: {
          batch_limit: params.batch_limit,
          dry_run: params.dry_run,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  const cancelJob = useMutation({
    mutationFn: async (params: { job_id: string; reason?: string }) => {
      return invokePromote<{ ok: boolean; job_id: string; status: string }>({
        action: "cancel-job",
        payload: { job_id: params.job_id, reason: params.reason },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  return {
    jobs: jobsQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    error: jobsQuery.error,
    refetchJobs: jobsQuery.refetch,
    promoteAll,
    cancelJob,
  };
}

/** Hook auxiliar para auditoria de um job específico (drawer). */
export function useSolarmarketPromoteLogs(jobId: string | null) {
  return useQuery({
    queryKey: LOGS_KEY(jobId),
    enabled: !!jobId,
    staleTime: 1000 * 30,
    queryFn: async (): Promise<PromotionLog[]> => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from("solarmarket_promotion_logs")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as PromotionLog[];
    },
  });
}
