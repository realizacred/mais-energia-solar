import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useConcessionariasAtivas(enabled: boolean) {
  return useQuery({
    queryKey: ["concessionarias-ativas-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concessionarias")
        .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, aliquota_icms, pis_percentual, cofins_percentual")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: STALE_TIME,
  });
}
