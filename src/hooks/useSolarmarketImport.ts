/**
 * useSolarmarketImport — Hook para disparar e acompanhar importação one-shot
 * do SolarMarket via edge function `solarmarket-import`.
 *
 * RB-04: queries em hook. RB-05: staleTime obrigatório.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";

export interface ImportScope {
  clientes: boolean;
  projetos: boolean;
  propostas: boolean;
  funis: boolean;
  custom_fields: boolean;
}

export interface SolarmarketImportJob {
  id: string;
  status: string;
  scope: any;
  current_step: string | null;
  progress_pct: number | null;
  total_clientes: number;
  total_projetos: number;
  total_propostas: number;
  total_funis: number;
  total_custom_fields: number;
  total_errors: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at?: string | null;
}

const JOBS_KEY = ["solarmarket-import-jobs"];
const IMPORT_RECOVERY_WINDOW_MS = 1000 * 60 * 2;

function isAmbiguousEdgeFunctionFailure(message: string) {
  const normalized = (message || "").toLowerCase();
  return (
    normalized.includes("edge function returned a non-2xx") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror")
  );
}

async function findRecentActiveImportJob(): Promise<SolarmarketImportJob | null> {
  const { data, error } = await (supabase as any)
    .from("solarmarket_import_jobs")
    .select(
      "id, status, scope, current_step, progress_pct, total_clientes, total_projetos, total_propostas, total_funis, total_custom_fields, total_errors, error_message, started_at, finished_at, created_at"
    )
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const startedAt = new Date(data.started_at ?? data.created_at).getTime();
  if (Number.isNaN(startedAt)) return null;
  if (Date.now() - startedAt > IMPORT_RECOVERY_WINDOW_MS) return null;

  return data as SolarmarketImportJob;
}

export function useSolarmarketImport() {
  const queryClient = useQueryClient();

  const jobsQuery = useQuery({
    queryKey: JOBS_KEY,
    queryFn: async (): Promise<SolarmarketImportJob[]> => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .select(
          "id, status, scope, current_step, progress_pct, total_clientes, total_projetos, total_propostas, total_funis, total_custom_fields, total_errors, error_message, started_at, finished_at, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SolarmarketImportJob[];
    },
    staleTime: 1000 * 30,
  });

  // Realtime: refetch quando jobs mudam
  useEffect(() => {
    const ch = supabase
      .channel("sm-import-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solarmarket_import_jobs" },
        () => queryClient.invalidateQueries({ queryKey: JOBS_KEY })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "solarmarket-import",
        { body: { action: "test-connection" } }
      );
      if (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message || "Erro ao testar conexão SolarMarket.");
      }
      return data;
    },
  });

  const importAll = useMutation({
    mutationFn: async (scope: ImportScope) => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "solarmarket-import",
          { body: { action: "import-all", scope } }
        );
        if (error) throw error;
        return data;
      } catch (error) {
        const parsed = await parseInvokeError(error);

        if (isAmbiguousEdgeFunctionFailure(parsed.message)) {
          const recentJob = await findRecentActiveImportJob();
          if (recentJob) {
            return {
              ok: true,
              job_id: recentJob.id,
              status: recentJob.status,
              recovered_from_gateway: true,
            };
          }
        }

        throw new Error(parsed.message || "Erro ao iniciar importação SolarMarket.");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  const cancelImport = useMutation({
    mutationFn: async (jobId: string) => {
      // RB-58: usar .select() para garantir que o UPDATE afetou linhas
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .update({
          status: "cancelled",
          error_message: "Cancelado manualmente pelo usuário.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .in("status", ["pending", "running"])
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Job não encontrado ou já finalizado.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  const clearHistory = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "solarmarket-import",
        { body: { action: "clear-history" } }
      );
      if (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message || "Erro ao limpar histórico.");
      }
      return data as { ok: boolean; removed: { jobs: number; logs: number } };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
    },
  });

  const clearStaging = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "solarmarket-import",
        { body: { action: "clear-staging" } }
      );
      if (error) {
        const parsed = await parseInvokeError(error);
        throw new Error(parsed.message || "Erro ao limpar dados importados.");
      }
      return data as {
        ok: boolean;
        removed: Record<string, number>;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOBS_KEY });
      queryClient.invalidateQueries({ queryKey: ["sm-imported-counts"] });
      queryClient.invalidateQueries({ queryKey: ["sm-imported-list"] });
    },
  });

  return {
    jobs: jobsQuery.data ?? [],
    isLoading: jobsQuery.isLoading,
    testConnection,
    importAll,
    cancelImport,
    clearHistory,
    clearStaging,
  };
}
