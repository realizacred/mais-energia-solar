import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useSolarPlantsCount() {
  return useQuery({
    queryKey: ["integration-plant-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("solar_plants" as any).select("integration_id");
      const counts: Record<string, number> = {};
      ((data as any[]) || []).forEach((p) => {
        if (p.integration_id) counts[p.integration_id] = (counts[p.integration_id] || 0) + 1;
      });
      return counts;
    },
    staleTime: STALE_TIME,
  });
}
