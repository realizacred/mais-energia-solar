/**
 * useFornecedoresNomes — busca nomes de fornecedores ativos para autocomplete.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FornecedorNome {
  id: string;
  nome: string;
}

const STALE_TIME = 1000 * 60 * 10; // 10 min — dados semi-estáticos

export function useFornecedoresNomes() {
  return useQuery({
    queryKey: ["fornecedores-nomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FornecedorNome[];
    },
    staleTime: STALE_TIME,
  });
}
