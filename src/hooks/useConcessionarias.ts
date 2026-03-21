/**
 * useConcessionarias — Hook for concessionarias select data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConcessionariaOption {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
}

export function useConcessionarias() {
  return useQuery({
    queryKey: ["concessionarias_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concessionarias")
        .select("id, nome, sigla, estado")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as ConcessionariaOption[];
    },
    staleTime: 1000 * 60 * 15,
  });
}
