/**
 * useSmMappings — hooks de leitura/gravação dos mapeamentos manuais
 * SolarMarket → CRM (sm_funil_pipeline_map e sm_etapa_stage_map).
 *
 * Governança:
 *  - RB-04: queries em hooks dedicados
 *  - RB-05: staleTime obrigatório
 *  - RB-58: UPDATE/UPSERT crítico verifica retorno
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 2;

export interface FunilMapRow {
  id: string;
  sm_funil_name: string;
  pipeline_id: string;
}

export interface EtapaMapRow {
  id: string;
  sm_funil_name: string;
  sm_etapa_name: string;
  stage_id: string;
}

export function useFunilMap() {
  return useQuery<FunilMapRow[]>({
    queryKey: ["sm-funil-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as never as {
        from: (t: string) => { select: (s: string) => Promise<{ data: FunilMapRow[] | null; error: { message: string } | null }> };
      })
        .from("sm_funil_pipeline_map")
        .select("id, sm_funil_name, pipeline_id");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}

export function useEtapaMap(smFunilName: string | null) {
  return useQuery<EtapaMapRow[]>({
    queryKey: ["sm-etapa-map", smFunilName],
    queryFn: async () => {
      if (!smFunilName) return [];
      const { data, error } = await (supabase as never as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (c: string, v: string) => Promise<{ data: EtapaMapRow[] | null; error: { message: string } | null }>;
          };
        };
      })
        .from("sm_etapa_stage_map")
        .select("id, sm_funil_name, sm_etapa_name, stage_id")
        .eq("sm_funil_name", smFunilName);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: STALE_TIME,
    enabled: !!smFunilName,
  });
}

export function useSaveFunilMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { sm_funil_name: string; pipeline_id: string }[]) => {
      if (!rows.length) return;
      const { error } = await (supabase as never as {
        from: (t: string) => {
          upsert: (rows: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("sm_funil_pipeline_map")
        .upsert(rows, { onConflict: "tenant_id,sm_funil_name" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-funil-map"] });
    },
  });
}

export function useSaveEtapaMap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { sm_funil_name: string; sm_etapa_name: string; stage_id: string }[]) => {
      if (!rows.length) return;
      const { error } = await (supabase as never as {
        from: (t: string) => {
          upsert: (rows: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("sm_etapa_stage_map")
        .upsert(rows, { onConflict: "tenant_id,sm_funil_name,sm_etapa_name" });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      const funil = vars[0]?.sm_funil_name;
      qc.invalidateQueries({ queryKey: ["sm-etapa-map", funil] });
    },
  });
}
