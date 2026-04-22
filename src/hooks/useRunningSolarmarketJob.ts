/**
 * useRunningSolarmarketJob — Retorna o job ativo mais recente do SolarMarket.
 *
 * RB-04: query em hook. RB-05: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRunningSolarmarketJob(tenantId: string | null) {
  return useQuery({
    queryKey: ["sm_running_job", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 5,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solarmarket_import_jobs")
        .select(
          "id, status, total_clientes, total_projetos, total_projeto_funis, total_propostas, total_funis, total_custom_fields, updated_at, created_at"
        )
        .eq("tenant_id", tenantId!)
        .in("status", ["running", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  });
}