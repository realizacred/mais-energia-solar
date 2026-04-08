import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useProjetoActivities(dealId: string) {
  return useQuery({
    queryKey: ["deal-activities", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deal_activities")
        .select("id, title, description, activity_type, due_date, status, created_at, assigned_to, completed_at")
        .eq("deal_id", dealId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50);
      return (data || []) as any[];
    },
    staleTime: STALE_TIME,
    enabled: !!dealId,
  });
}
