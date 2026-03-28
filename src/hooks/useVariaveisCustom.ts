/**
 * Hook para CRUD de proposta_variaveis_custom (VariaveisCustomManager).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VariavelCustom {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
}

const QUERY_KEY = "proposta-variaveis-custom" as const;
const STALE_TIME = 1000 * 60 * 15;

export function useVariaveisCustom() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_variaveis_custom")
        .select("id, nome, label, expressao, tipo_resultado, categoria, ordem, ativo, descricao")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as VariavelCustom[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarVariavelCustom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string | null } & Record<string, unknown>) => {
      const { id, ...rest } = payload;
      if (id && id !== "new") {
        const { error } = await supabase
          .from("proposta_variaveis_custom")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("proposta_variaveis_custom")
          .insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarVariavelCustom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposta_variaveis_custom")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
