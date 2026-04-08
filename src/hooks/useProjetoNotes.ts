import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useProjetoNotes(dealId: string, userNamesMap: Map<string, string>) {
  return useQuery({
    queryKey: ["deal-notes", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_notes")
        .select("id, content, created_at, created_by")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data) return [];
      return data.map((n: any) => ({
        ...n,
        created_by_name: n.created_by ? (userNamesMap.get(n.created_by) || "Usuário") : "Sistema",
      }));
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}
