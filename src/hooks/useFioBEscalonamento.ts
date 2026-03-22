// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15;
const QUERY_KEY = "fio-b-escalonamento" as const;

export interface FioBItem {
  id: string;
  ano: number;
  percentual_nao_compensado: number;
}

export function useFioBEscalonamento() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fio_b_escalonamento")
        .select("id, ano, percentual_nao_compensado")
        .order("ano", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((d) => ({
        id: d.id,
        ano: d.ano,
        percentual_nao_compensado: Number(d.percentual_nao_compensado),
      })) as FioBItem[];
    },
    staleTime: STALE_TIME,
  });
}

export function useUpdateFioB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, percentual_nao_compensado }: { id: string; percentual_nao_compensado: number }) => {
      const { error } = await supabase
        .from("fio_b_escalonamento")
        .update({ percentual_nao_compensado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useAddFioB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ano, percentual_nao_compensado }: { ano: number; percentual_nao_compensado: number }) => {
      const { error } = await supabase
        .from("fio_b_escalonamento")
        .insert({ ano, percentual_nao_compensado });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useDeleteFioB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fio_b_escalonamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}
