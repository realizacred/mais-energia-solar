// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "financiamento-bancos" as const;

export interface BancoRow {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
  ativo: boolean;
  ordem: number;
  isNew?: boolean;
}

export function useFinanciamentoBancos() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financiamento_bancos")
        .select("id, nome, taxa_mensal, max_parcelas, ativo, ordem")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as unknown as BancoRow[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveFinanciamentoBancos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bancos: BancoRow[]) => {
      for (const banco of bancos) {
        const { isNew, id, ...payload } = banco;
        if (isNew) {
          const { error } = await supabase.from("financiamento_bancos").insert(payload as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("financiamento_bancos").update(payload as any).eq("id", id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}
