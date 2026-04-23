/**
 * useChunkedMigration — Migração SolarMarket via edge `sm-migrate-chunk`.
 *
 * Estratégia (Opção C — wrapper chunked):
 *   1. start  → edge cria 1 job mestre e retorna master_job_id
 *   2. step   → frontend chama em loop; cada step processa 100 propostas
 *               (a edge invoca sm-promote internamente com batch_limit=100)
 *   3. status → polling React Query a cada 2s mostra progresso real
 *   4. cancel → marca job mestre como cancelled
 *
 * Por quê: sm-promote em chamada única estoura memória com 1823 propostas.
 * Em chunks de 100, cada invocação cabe em ~3 MB e dura ~10-30s.
 */
import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const LEGACY_SM_SOURCES = ["solarmarket", "solar_market"] as const;

export interface ChunkedJob {
  id: string;
  status: string;
  total_items: number;
  items_processed: number;
  items_promoted: number;
  items_with_errors: number;
  items_with_warnings: number;
  items_blocked: number;
  items_skipped: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface ChunkedProgress {
  job: ChunkedJob | null;
  totals: {
    clientes: { promoted: number; total: number };
    projetos: { promoted: number; total: number };
    propostas: { promoted: number; total: number };
  };
  isRunning: boolean;
  isComplete: boolean;
  pctGeral: number;
  lastError: string | null;
}

const KEY = ["sm-migrate-chunk", "progress"] as const;

export function useChunkedMigration() {
  const qc = useQueryClient();
  const [masterJobId, setMasterJobId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Loop de execução: dispara steps até has_more=false
  const runLoop = useCallback(
    async (jobId: string) => {
      cancelledRef.current = false;
      let safety = 100; // máx 100 chunks (=10.000 propostas) — proteção contra loop
      while (safety-- > 0) {
        if (cancelledRef.current) return;
        const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
          body: { action: "step", payload: { master_job_id: jobId } },
        });
        if (error) {
          setLastError(error.message || "Falha no chunk");
          return;
        }
        const resp = data as { ok: boolean; has_more?: boolean; error?: string };
        if (!resp?.ok) {
          setLastError(resp?.error ?? "Chunk retornou erro");
          return;
        }
        // refresca polling para o usuário ver
        qc.invalidateQueries({ queryKey: KEY });
        if (!resp.has_more) return;
        // pequena pausa para não saturar
        await new Promise((r) => setTimeout(r, 500));
      }
      setLastError("Loop atingiu limite de segurança (100 chunks).");
    },
    [qc],
  );

  const start = useMutation({
    mutationFn: async () => {
      setLastError(null);
      const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
        body: { action: "start", payload: {} },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar.");
      const resp = data as { ok: boolean; master_job_id?: string; total_backlog?: number; error?: string };
      if (!resp?.ok || !resp.master_job_id) {
        throw new Error(resp?.error ?? "Resposta inválida do backend.");
      }
      setMasterJobId(resp.master_job_id);
      // dispara o loop em background; não aguardamos pra UI ficar responsiva
      void runLoop(resp.master_job_id);
      return resp;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const cancel = useMutation({
    mutationFn: async (jobId: string) => {
      cancelledRef.current = true;
      const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
        body: { action: "cancel", payload: { master_job_id: jobId } },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const progressQuery = useQuery<ChunkedProgress>({
    queryKey: [...KEY, masterJobId],
    staleTime: 1000 * 2,
    refetchInterval: (query) => (query.state.data?.isRunning ? 2000 : 5000),
    queryFn: async (): Promise<ChunkedProgress> => {
      // 1. Job mais recente do tipo migrate-chunked
      const { data: jobRow } = await supabase
        .from("solarmarket_promotion_jobs")
        .select(
          "id, status, total_items, items_processed, items_promoted, items_with_errors, items_with_warnings, items_blocked, items_skipped, started_at, finished_at",
        )
        .eq("job_type", "migrate-chunked")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Sub-progresso por entidade (tabelas canônicas vs staging)
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

      const isRunning = !!jobRow && jobRow.status === "running";
      const isComplete =
        !!jobRow && (jobRow.status === "completed" || jobRow.status === "completed_with_warnings");

      const total = jobRow?.total_items ?? totals.propostas.total;
      const processed = jobRow?.items_processed ?? 0;
      const pctGeral = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

      return {
        job: jobRow
          ? {
              id: jobRow.id,
              status: jobRow.status,
              total_items: jobRow.total_items ?? 0,
              items_processed: jobRow.items_processed ?? 0,
              items_promoted: jobRow.items_promoted ?? 0,
              items_with_errors: jobRow.items_with_errors ?? 0,
              items_with_warnings: jobRow.items_with_warnings ?? 0,
              items_blocked: jobRow.items_blocked ?? 0,
              items_skipped: jobRow.items_skipped ?? 0,
              started_at: jobRow.started_at,
              finished_at: jobRow.finished_at,
            }
          : null,
        totals,
        isRunning,
        isComplete,
        pctGeral,
        lastError,
      };
    },
  });

  return {
    start,
    cancel,
    progress: progressQuery.data,
    isLoading: progressQuery.isLoading,
    masterJobId,
  };
}