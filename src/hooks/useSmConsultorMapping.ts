import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmConsultorMapping {
  id: string;
  sm_name: string;
  canonical_name: string;
  consultor_id: string | null;
  is_ex_funcionario: boolean;
  created_at: string;
  updated_at: string;
}

export interface SmConsultorMappingInput {
  sm_name: string;
  canonical_name: string;
  consultor_id: string | null;
  is_ex_funcionario: boolean;
}

const QUERY_KEY = ["sm-consultor-mapping"] as const;

export function useSmConsultorMappings() {
  return useQuery<SmConsultorMapping[]>({
    queryKey: QUERY_KEY,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_consultor_mapping")
        .select("*")
        .order("sm_name");
      if (error) throw error;
      return (data ?? []) as SmConsultorMapping[];
    },
  });
}

export function useUpsertSmConsultorMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SmConsultorMappingInput & { id?: string }) => {
      const payload = {
        sm_name: input.sm_name.trim(),
        canonical_name: input.canonical_name.trim(),
        consultor_id: input.consultor_id || null,
        is_ex_funcionario: input.is_ex_funcionario,
      };

      if (input.id) {
        const { data, error } = await (supabase as any)
          .from("sm_consultor_mapping")
          .update(payload)
          .eq("id", input.id)
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error("Mapeamento não encontrado");
        }
        return data[0];
      }

      const { data, error } = await (supabase as any)
        .from("sm_consultor_mapping")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteSmConsultorMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("sm_consultor_mapping")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
