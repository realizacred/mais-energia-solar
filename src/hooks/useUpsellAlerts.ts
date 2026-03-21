import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UpsellAlert {
  id: string;
  tenant_id: string;
  metric_key: string;
  percentage: number;
  status: "warning" | "blocked";
  current_value: number;
  limit_value: number;
  created_at: string;
}

const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Hook to fetch active (unresolved) upsell events for the current tenant.
 * §16: queries only in hooks. §23: staleTime mandatory.
 */
export function useUpsellAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["upsell-alerts"],
    queryFn: async (): Promise<UpsellAlert[]> => {
      const { data, error } = await supabase
        .from("upsell_events")
        .select("id, tenant_id, metric_key, percentage, status, current_value, limit_value, created_at")
        .is("resolved_at", null)
        .order("percentage", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UpsellAlert[];
    },
    enabled: !!user,
    staleTime: STALE_TIME,
  });
}
