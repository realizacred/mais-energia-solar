/**
 * useProposalVersionSnapshot.ts
 *
 * Hook para buscar o snapshot de uma versão de proposta.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "proposal-version-snapshot" as const;

export function useProposalVersionSnapshot(versaoId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, versaoId],
    queryFn: async () => {
      if (!versaoId) return null;
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("snapshot")
        .eq("id", versaoId)
        .single();
      if (error) throw error;
      return (data?.snapshot as Record<string, unknown>) || {};
    },
    staleTime: STALE_TIME,
    enabled: !!versaoId,
  });
}
