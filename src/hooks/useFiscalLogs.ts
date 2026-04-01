import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useFiscalProviderRequests() {
  return useQuery({
    queryKey: ["fiscal-provider-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_provider_requests")
        .select("id, endpoint, method, response_status, duration_ms, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}

export function useFiscalProviderWebhooks() {
  return useQuery({
    queryKey: ["fiscal-provider-webhooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fiscal_provider_webhooks")
        .select("id, event_type, processed, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_TIME,
  });
}
