import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadScoreSummary {
  score: number;
  nivel: "hot" | "warm" | "cold";
}

/**
 * Lightweight hook that returns a Map<lead_id, LeadScoreSummary>
 * for displaying score badges on pipeline cards.
 * §16: Query in hook — §23: staleTime 5min
 */
export function useLeadScoresMap() {
  return useQuery({
    queryKey: ["lead-scores-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_scores")
        .select("lead_id, score, nivel");
      if (error) throw error;
      const map = new Map<string, LeadScoreSummary>();
      for (const row of data || []) {
        map.set(row.lead_id, { score: row.score, nivel: row.nivel as "hot" | "warm" | "cold" });
      }
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });
}
