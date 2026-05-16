/**
 * @deprecated substituído por useCreditConfigs
 * Reutiliza: credit_bank_configs
 */

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
        .from("credit_bank_configs")
        .select("*")
        .order("bank_name", { ascending: true });
      
      if (error) throw error;

      // Adapt to legacy interface
      return (data || []).map(b => ({
        id: b.id,
        nome: b.bank_name,
        taxa_mensal: (b.technical_metadata as any)?.taxa_mensal || 0,
        max_parcelas: (b.technical_metadata as any)?.max_parcelas || 60,
        ativo: b.is_active,
        ordem: 0
      })) as BancoRow[];
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
        const updateData = {
          bank_name: payload.nome,
          is_active: payload.ativo,
          technical_metadata: {
            taxa_mensal: payload.taxa_mensal,
            max_parcelas: payload.max_parcelas
          }
        };

        if (isNew) {
          const { error } = await supabase.from("credit_bank_configs").insert(updateData as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("credit_bank_configs").update(updateData as any).eq("id", id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}
