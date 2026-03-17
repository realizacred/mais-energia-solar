import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FollowupPending {
  id: string;
  conversation_id: string;
  assigned_to: string | null;
  rule_id: string | null;
}

export function useWaFollowupPending() {
  return useQuery({
    queryKey: ["wa-followup-pending-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .select("id, conversation_id, assigned_to, rule_id")
        .eq("status", "pendente");
      if (error) throw error;
      return (data || []) as FollowupPending[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
