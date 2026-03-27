// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15; // 15 min — config estática
const QUERY_KEY = "pricing-config" as const;

export interface PricingConfigRow {
  id: string;
  margem_minima_percent: number | null;
  comissao_padrao_percent: number | null;
  desconto_maximo_percent: number | null;
}

/**
 * Hook para carregar pricing_config do tenant (SSOT).
 * Substitui queries inline de pricing_config em componentes.
 */
export function usePricingConfig() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_config")
        .select("id, margem_minima_percent, comissao_padrao_percent, desconto_maximo_percent")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as PricingConfigRow) ?? null;
    },
    staleTime: STALE_TIME,
  });
}
