/**
 * useDealDocChecklist.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Hook para ler e salvar checklist de documentos do deal.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "deal-doc-checklist" as const;

export function useDealDocChecklist(dealId: string) {
  return useQuery({
    queryKey: [QUERY_KEY, dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("doc_checklist")
        .eq("id", dealId)
        .single();
      if (error) throw error;
      if (data?.doc_checklist && typeof data.doc_checklist === "object") {
        return data.doc_checklist as Record<string, boolean>;
      }
      return {} as Record<string, boolean>;
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}

export function useUpdateDealDocChecklist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, checklist }: { dealId: string; checklist: Record<string, boolean> }) => {
      const { error } = await supabase
        .from("deals")
        .update({ doc_checklist: checklist } as any)
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.dealId] });
    },
  });
}
