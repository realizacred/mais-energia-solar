import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaResolutionEventsKpi {
  pending: number;
  processed: number;
  errors: number;
}

export function useWaResolutionEvents() {
  return useQuery<WaResolutionEventsKpi>({
    queryKey: ["wa-health-resolution-events"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [pending, processed, errors] = await Promise.all([
        supabase.from("wa_conversation_resolution_events").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("wa_conversation_resolution_events").select("*", { count: "exact", head: true }).eq("status", "processed"),
        supabase.from("wa_conversation_resolution_events").select("*", { count: "exact", head: true }).eq("status", "error"),
      ]);
      return {
        pending: pending.count ?? 0,
        processed: processed.count ?? 0,
        errors: errors.count ?? 0,
      };
    },
  });
}
