import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useQuickAudit() {
  return useQuery({
    queryKey: ["audit-quick"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "audit-variables", { body: { mode: "quick" } }
      );
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: true,
  });
}

export function useFullAudit() {
  return useMutation({
    mutationFn: async (propostaId?: string) => {
      const { data, error } = await supabase.functions.invoke(
        "audit-variables",
        { body: { mode: "full", proposta_id: propostaId } }
      );
      if (error) throw error;
      return data;
    }
  });
}
