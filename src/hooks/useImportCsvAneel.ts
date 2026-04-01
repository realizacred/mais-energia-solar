/**
 * Hook para dados de ImportCsvAneelDialog.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface ConcessionariaMatchData {
  id: string;
  nome: string;
  sigla: string | null;
  nome_aneel_oficial: string | null;
}

export interface AneelAlias {
  concessionaria_id: string;
  alias_aneel: string;
}

// ─── Concessionarias + Aliases for matching ──────────────────────────
export function useConcessionariasForMatch(enabled = true) {
  return useQuery({
    queryKey: ["concessionarias-aneel-match"],
    queryFn: async () => {
      const [concRes, aliasRes] = await Promise.all([
        supabase.from("concessionarias").select("id, nome, sigla, nome_aneel_oficial"),
        supabase.from("concessionaria_aneel_aliases").select("concessionaria_id, alias_aneel"),
      ]);
      if (concRes.error) throw concRes.error;
      if (aliasRes.error) throw aliasRes.error;
      return {
        concessionarias: (concRes.data || []) as ConcessionariaMatchData[],
        aliases: (aliasRes.data || []) as AneelAlias[],
      };
    },
    enabled,
    staleTime: STALE_TIME,
  });
}

// ─── Audit log insert ──────────────────────────
export function useInsertAneelSyncRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase.from("aneel_sync_runs").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aneel-sync-runs"] });
    },
  });
}
