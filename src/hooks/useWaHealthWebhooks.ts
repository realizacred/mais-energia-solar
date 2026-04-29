import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaWebhookRow {
  id: string;
  created_at: string;
  event_type: string;
  processed: boolean;
  error: string | null;
}

export function useWaHealthWebhooks() {
  return useQuery<WaWebhookRow[]>({
    queryKey: ["wa-health-webhooks"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_webhook_events")
        .select("id, created_at, event_type, processed, error")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WaWebhookRow[];
    },
  });
}
