/**
 * useSmEtapasFunil — extrai as etapas (stages) de um funil específico
 * do staging do SolarMarket. Usado no Step 2 do wizard de migração para
 * mapear etapa→consultor (papel "vendedor_source") ou etapa→stage (papel "pipeline").
 *
 * Governança:
 *  - RB-04: query em hook dedicado
 *  - RB-05: staleTime obrigatório
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface SmEtapaRow {
  smEtapaId: string;
  smEtapaName: string;
}

interface RawStage {
  id?: number | string;
  name?: string;
}

interface RawFunilPayload {
  name?: string;
  stages?: RawStage[];
}

export function useSmEtapasFunil(
  tenantId: string | null | undefined,
  smFunilName: string | null | undefined,
) {
  return useQuery<SmEtapaRow[]>({
    queryKey: ["sm-etapas-funil", tenantId, smFunilName],
    enabled: !!tenantId && !!smFunilName,
    staleTime: STALE_TIME,
    queryFn: async () => {
      // Busca todos os funis do tenant e filtra pelo nome em memória
      // (payload->>'name' não bate por igualdade direta com .eq de jsonb).
      const { data, error } = await supabase
        .from("sm_funis_raw")
        .select("payload")
        .eq("tenant_id", tenantId!);

      if (error) throw new Error(error.message);

      const row = (data ?? []).find(
        (r) => String((r.payload as RawFunilPayload | null)?.name ?? "").trim() === smFunilName,
      );
      const stages = (row?.payload as RawFunilPayload | null)?.stages ?? [];
      return stages
        .map<SmEtapaRow>((s) => ({
          smEtapaId: String(s.id ?? ""),
          smEtapaName: String(s.name ?? "").trim(),
        }))
        .filter((s) => s.smEtapaName.length > 0)
        .sort((a, b) => a.smEtapaName.localeCompare(b.smEtapaName, "pt-BR"));
    },
  });
}
