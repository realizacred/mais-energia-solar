// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "tenant-feriados" as const;

export interface Feriado {
  id?: string;
  data: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

export function useFeriados(tenantId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_feriados")
        .select("id, data, nome, tipo, ativo")
        .eq("tenant_id", tenantId)
        .order("data");
      if (error) throw error;
      return (data ?? []) as Feriado[];
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

export function useAddFeriado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tenant_id: string; data: string; nome: string; tipo: string }) => {
      const { error } = await supabase.from("tenant_feriados").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useSeedFeriadosNacionais() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { tenant_id: string; data: string; nome: string; tipo: string; ativo: boolean }[]) => {
      const { error } = await supabase
        .from("tenant_feriados")
        .upsert(rows, { onConflict: "tenant_id,data" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}

export function useRemoveFeriado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_feriados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [QUERY_KEY] }); },
  });
}
