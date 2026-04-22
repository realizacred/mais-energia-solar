/**
 * useLastSolarmarketJob — Retorna o job mais recente do SolarMarket (qualquer status).
 *
 * Usado para inspecionar quais steps foram concluídos (scope._runtime.steps[X].done),
 * mesmo quando o job terminou em erro/cancelado.
 *
 * RB-04 / RB-05.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmStepRuntime {
  done?: boolean;
  page?: number;
  pathUsed?: string | null;
}

export interface SmJobRow {
  id: string;
  status: string;
  current_step: string | null;
  progress_pct: number | null;
  total_clientes: number | null;
  total_projetos: number | null;
  total_projeto_funis: number | null;
  total_propostas: number | null;
  total_funis: number | null;
  total_custom_fields: number | null;
  scope: {
    _runtime?: { steps?: Record<string, SmStepRuntime> };
  } | null;
  updated_at: string;
  created_at: string;
}

export function useLastSolarmarketJob(tenantId: string | null) {
  return useQuery<SmJobRow | null>({
    queryKey: ["sm_last_job", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 5,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .select(
          "id, status, current_step, progress_pct, total_clientes, total_projetos, total_projeto_funis, total_propostas, total_funis, total_custom_fields, scope, updated_at, created_at",
        )
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as SmJobRow) ?? null;
    },
  });
}
