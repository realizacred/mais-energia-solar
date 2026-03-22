// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15;

export interface ConsultorListItem {
  id: string;
  nome: string;
  user_id?: string;
}

export function useConsultoresList() {
  return useQuery({
    queryKey: ["consultores_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ConsultorListItem[];
    },
    staleTime: STALE_TIME,
  });
}

export function useConsultoresListWithUserId() {
  return useQuery({
    queryKey: ["consultores_list_with_user_id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, user_id")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ConsultorListItem[];
    },
    staleTime: STALE_TIME,
  });
}
