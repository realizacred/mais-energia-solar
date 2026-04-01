import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useReleaseHistory() {
  return useQuery({
    queryKey: ["release-checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("release_checklists")
        .select("id, versao, commit_hash, ambiente, status, itens, aprovado_por, aprovado_em, criado_por, observacoes, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        itens: typeof r.itens === "string" ? JSON.parse(r.itens) : r.itens,
      }));
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshReleaseHistory() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["release-checklists"] });
}
