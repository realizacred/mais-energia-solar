/**
 * Hook para CRUD de projeto_etiquetas (EtiquetasManager).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjetoEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
  ordem: number;
  ativo: boolean;
}

const QUERY_KEY = "projeto-etiquetas" as const;
const STALE_TIME = 1000 * 60 * 15;

export function useProjetoEtiquetas() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_etiquetas")
        .select("id, nome, cor, grupo, short, icon, ordem, ativo")
        .order("grupo")
        .order("ordem");
      if (error) throw error;
      return (data as ProjetoEtiqueta[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string | null } & Record<string, unknown>) => {
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase
          .from("projeto_etiquetas")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_etiquetas")
          .insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarEtiqueta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_etiquetas")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
