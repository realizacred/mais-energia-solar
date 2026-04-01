import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useVendedorMetasData() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return useQuery({
    queryKey: ["vendedor-metas-data", currentMonth, currentYear],
    queryFn: async () => {
      const [configRes, vendedoresRes, metasRes] = await Promise.all([
        (supabase as any)
          .from("gamification_config")
          .select("meta_orcamentos_mensal, meta_conversoes_mensal, meta_valor_mensal, comissao_base_percent")
          .single(),
        supabase
          .from("consultores")
          .select("id, nome, ativo")
          .eq("ativo", true)
          .order("nome"),
        (supabase as any)
          .from("consultor_metas")
          .select("id, consultor_id, mes, ano, meta_orcamentos, meta_conversoes, meta_valor, comissao_percent, usa_meta_individual")
          .eq("mes", currentMonth)
          .eq("ano", currentYear),
      ]);

      return {
        globalConfig: configRes.data ? {
          meta_orcamentos_mensal: configRes.data.meta_orcamentos_mensal,
          meta_conversoes_mensal: configRes.data.meta_conversoes_mensal,
          meta_valor_mensal: Number(configRes.data.meta_valor_mensal),
          comissao_base_percent: Number(configRes.data.comissao_base_percent),
        } : null,
        vendedores: vendedoresRes.data || [],
        metas: metasRes.data || [],
      };
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshVendedorMetas() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["vendedor-metas-data"] });
}
