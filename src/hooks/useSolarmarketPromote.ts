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

const LEGACY_SM_SOURCES = ["solarmarket", "solar_market"] as const;

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
  raw_status?: string | null;
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
    mutationFn: async (params: {
      batch_limit: number;
      dry_run: boolean;
      scope?: "cliente" | "projeto" | "proposta";
    }) => {
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
          scope: params.scope ?? "proposta",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["sm-promote", "totals"] });
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

  /**
   * Limpa histórico de jobs finalizados (failed, cancelled, completed_with_errors).
   * Apaga também os logs associados via FK ON DELETE CASCADE no banco.
   * Não toca em jobs em execução nem em jobs concluídos com sucesso.
   */
  const clearFailedJobs = useMutation({
    mutationFn: async () => {
      const failedStatuses = ["failed", "cancelled", "completed_with_errors"];
      // Apaga logs primeiro (caso não haja CASCADE configurado)
      const { data: jobsToDelete, error: fetchErr } = await supabase
        .from("solarmarket_promotion_jobs")
        .select("id")
        .in("status", failedStatuses);
      if (fetchErr) throw new Error(fetchErr.message);
      const ids = (jobsToDelete ?? []).map((j) => j.id);
      if (ids.length === 0) return { deleted: 0 };

      const { error: logsErr } = await supabase
        .from("solarmarket_promotion_logs")
        .delete()
        .in("job_id", ids);
      if (logsErr) throw new Error(logsErr.message);

      const { error: jobsErr } = await supabase
        .from("solarmarket_promotion_jobs")
        .delete()
        .in("id", ids);
      if (jobsErr) throw new Error(jobsErr.message);
      return { deleted: ids.length };
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
    clearFailedJobs,
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
      return ((data ?? []) as unknown as PromotionLog[]).map((log) => ({
        ...log,
        raw_status: typeof log.details?.raw_status === "string" ? log.details.raw_status : null,
      }));
    },
  });
}

export type SolarmarketStagingTotals = {
  cliente: { total: number; promoted: number };
  projeto: { total: number; promoted: number };
  proposta: { total: number; promoted: number };
};

/**
 * Totais agregados staging vs promovidos para a Fase 2.
 * Mostra "X de Y" por tipo (cliente/projeto/proposta) — visão acumulada.
 */
export function useSolarmarketStagingTotals() {
  return useQuery({
    queryKey: ["sm-promote", "totals"] as const,
    staleTime: 1000 * 60, // 1min
    refetchInterval: 1000 * 30,
    queryFn: async (): Promise<SolarmarketStagingTotals> => {
      const [cliRaw, projRaw, propRaw, clientesPromovidos, projetosPromovidos, propostasPromovidas] = await Promise.all([
        supabase.from("sm_clientes_raw").select("id", { count: "exact", head: true }),
        supabase.from("sm_projetos_raw").select("id", { count: "exact", head: true }),
        supabase.from("sm_propostas_raw").select("id", { count: "exact", head: true }),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .in("external_source", [...LEGACY_SM_SOURCES]),
        supabase
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .in("external_source", [...LEGACY_SM_SOURCES])
          .not("deal_id", "is", null),
        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .in("external_source", [...LEGACY_SM_SOURCES])
          .not("deal_id", "is", null),
      ]);

      if (cliRaw.error) throw new Error(cliRaw.error.message);
      if (projRaw.error) throw new Error(projRaw.error.message);
      if (propRaw.error) throw new Error(propRaw.error.message);
      if (clientesPromovidos.error) throw new Error(clientesPromovidos.error.message);
      if (projetosPromovidos.error) throw new Error(projetosPromovidos.error.message);
      if (propostasPromovidas.error) throw new Error(propostasPromovidas.error.message);

      return {
        cliente: { total: cliRaw.count ?? 0, promoted: clientesPromovidos.count ?? 0 },
        projeto: { total: projRaw.count ?? 0, promoted: projetosPromovidos.count ?? 0 },
        proposta: { total: propRaw.count ?? 0, promoted: propostasPromovidas.count ?? 0 },
      };
    },
  });
}
