/**
 * useMigrateFull — Migração SolarMarket completa em 1 clique.
 *
 * Estratégia:
 *   - 1 invocação de `sm-promote` com scope=proposta cria clientes + projetos
 *     + propostas em cascata (já é o comportamento atual da edge).
 *   - Polling de `solarmarket_promotion_jobs` a cada 2s mostra progresso real.
 *   - Sub-progresso por entidade lido das tabelas canônicas (clientes,
 *     projetos, propostas_nativas) filtradas por external_source SM.
 *
 * Governança:
 *   - RB-04 / RB-05 / RB-58 respeitados (UPDATE crítico via edge dedicada).
 *   - Sem self-reinvoke, sem trigger novo, sem novas edges. Reusa SSOT.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LEGACY_SM_SOURCES = ["solarmarket", "solar_market"] as const;

export type MigrateFullProgress = {
  job: {
    id: string;
    status: string;
    items_processed: number;
    total_items: number;
    items_promoted: number;
    items_with_errors: number;
    items_blocked: number;
    items_with_warnings: number;
    started_at: string | null;
    finished_at: string | null;
  } | null;
  totals: {
    clientes: { promoted: number; total: number };
    projetos: { promoted: number; total: number };
    propostas: { promoted: number; total: number };
  };
  isRunning: boolean;
  isComplete: boolean;
  pctGeral: number;
};

const KEY = ["sm-migrate-full", "progress"] as const;

export function useMigrateFull() {
  const qc = useQueryClient();

  const start = useMutation({
    mutationFn: async (params: { batch_limit?: number; dry_run?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke("sm-promote", {
        body: {
          action: "promote-all",
          payload: {
            batch_limit: params.batch_limit ?? 10000,
            dry_run: !!params.dry_run,
            scope: "proposta", // cascade: cliente → projeto → proposta
          },
        },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar migração.");
      const resp = data as { ok?: boolean; error?: string; job_id?: string };
      if (!resp || resp.ok === false) {
        throw new Error(resp?.error ?? "Migração retornou erro.");
      }
      return resp as { ok: true; job_id: string; status: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["sm-promote", "jobs"] });
    },
  });

  const progressQuery = useQuery<MigrateFullProgress>({
    queryKey: KEY,
    staleTime: 1000 * 2,
    refetchInterval: (query) => {
      const data = query.state.data;
      // polling agressivo enquanto há job ativo
      return data?.isRunning ? 2000 : 5000;
    },
    queryFn: async (): Promise<MigrateFullProgress> => {
      // 1. Job mais recente (qualquer status) — espelha o estado da última execução
      const { data: jobRow } = await supabase
        .from("solarmarket_promotion_jobs")
        .select(
          "id, status, items_processed, total_items, items_promoted, items_with_errors, items_blocked, items_with_warnings, started_at, finished_at, filters",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // ignora jobs dry-run para métricas reais
      const isDry = (jobRow?.filters as { dry_run?: boolean } | null)?.dry_run === true;
      const job = jobRow && !isDry ? jobRow : null;

      // 2. Totais por entidade (staging vs canônico promovido)
      const [cliRaw, projRaw, propRaw, cliProm, projProm, propProm] = await Promise.all([
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
          .in("external_source", [...LEGACY_SM_SOURCES]),
        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .in("external_source", [...LEGACY_SM_SOURCES]),
      ]);

      const totals = {
        clientes: { promoted: cliProm.count ?? 0, total: cliRaw.count ?? 0 },
        projetos: { promoted: projProm.count ?? 0, total: projRaw.count ?? 0 },
        propostas: { promoted: propProm.count ?? 0, total: propRaw.count ?? 0 },
      };

      const isRunning = !!job && (job.status === "running" || job.status === "pending");
      const isComplete =
        !!job && (job.status === "completed" || job.status === "completed_with_warnings");

      const total = job?.total_items ?? totals.propostas.total;
      const processed = job?.items_processed ?? 0;
      const pctGeral = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

      return {
        job: job
          ? {
              id: job.id,
              status: job.status,
              items_processed: job.items_processed ?? 0,
              total_items: job.total_items ?? 0,
              items_promoted: job.items_promoted ?? 0,
              items_with_errors: job.items_with_errors ?? 0,
              items_blocked: job.items_blocked ?? 0,
              items_with_warnings: job.items_with_warnings ?? 0,
              started_at: job.started_at,
              finished_at: job.finished_at,
            }
          : null,
        totals,
        isRunning,
        isComplete,
        pctGeral,
      };
    },
  });

  const cancel = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("sm-promote", {
        body: {
          action: "cancel-job",
          payload: { job_id: jobId, reason: "Cancelado pelo usuário" },
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["sm-promote", "jobs"] });
    },
  });

  return {
    start,
    cancel,
    progress: progressQuery.data,
    isLoading: progressQuery.isLoading,
  };
}
