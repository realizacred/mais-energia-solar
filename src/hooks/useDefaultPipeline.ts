/**
 * useDefaultPipeline — Verifica se o tenant atual possui pipeline padrão definido.
 *
 * Usado pela tela de Promoção SolarMarket para bloquear ações quando o tenant
 * não tem nenhum pipeline marcado como `is_default = true`.
 *
 * Governança:
 *   - RB-04/RB-05: query em hook dedicado com staleTime
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DefaultPipelineInfo {
  id: string;
  name: string;
  stagesCount: number;
}

export function useDefaultPipeline() {
  return useQuery<DefaultPipelineInfo | null>({
    queryKey: ["default-pipeline"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: pipe, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!pipe) return null;

      const { count } = await supabase
        .from("pipeline_stages")
        .select("id", { count: "exact", head: true })
        .eq("pipeline_id", pipe.id);

      return { id: pipe.id, name: pipe.name, stagesCount: count ?? 0 };
    },
  });
}
