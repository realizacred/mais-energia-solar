import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useLeadStats() {
  return useQuery({
    queryKey: ["director-lead-stats"],
    queryFn: async () => {
      const [totalRes, semStatusRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("leads").select("id", { count: "exact", head: true }).is("deleted_at", null).is("status_id", null),
      ]);
      return {
        total: totalRes.count || 0,
        semStatus: semStatusRes.count || 0,
      };
    },
    staleTime: STALE_TIME,
  });
}
