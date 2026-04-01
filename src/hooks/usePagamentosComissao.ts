import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function usePagamentosComissao(comissaoId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pagamentos-comissao", comissaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_comissao")
        .select("id, valor_pago, data_pagamento, forma_pagamento, observacoes, comprovante_url")
        .eq("comissao_id", comissaoId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: STALE_TIME,
  });
}

export function useRefreshPagamentosComissao(comissaoId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pagamentos-comissao", comissaoId] });
}
