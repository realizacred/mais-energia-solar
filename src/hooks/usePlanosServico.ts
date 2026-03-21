/**
 * usePlanosServico — Hooks for service plans CRUD.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "planos_servico" as const;

export interface PlanoServico {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  valor: number;
  tipo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** List active planos for current tenant */
export function usePlanosServico() {
  return useQuery({
    queryKey: [QK],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_servico" as any)
        .select("*")
        .order("valor");
      if (error) throw error;
      return (data || []) as unknown as PlanoServico[];
    },
    staleTime: STALE_TIME,
  });
}

/** List only active planos for selects */
export function usePlanosServicoAtivos() {
  return useQuery({
    queryKey: [QK, "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos_servico" as any)
        .select("*")
        .eq("ativo", true)
        .order("valor");
      if (error) throw error;
      return (data || []) as unknown as PlanoServico[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSavePlanoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<PlanoServico> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { data, error } = await supabase
          .from("planos_servico" as any)
          .update({ ...rest, updated_at: new Date().toISOString() } as any)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("planos_servico" as any)
          .insert(rest as any)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

export function useDeletePlanoServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("planos_servico" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}
