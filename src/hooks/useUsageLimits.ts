import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UsageLimitData {
  allowed: boolean;
  current_value: number;
  limit_value: number;
  remaining: number;
}

const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Hook to check a single usage limit for the current tenant.
 * Uses the DB function check_tenant_limit (user-context).
 */
export function useUsageLimit(metricKey: string) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["usage-limit", metricKey],
    queryFn: async (): Promise<UsageLimitData> => {
      const { data, error } = await supabase.rpc("check_tenant_limit", {
        _metric_key: metricKey,
        _delta: 0,
      });
      if (error) throw error;
      const row = (data as any)?.[0];
      return row ?? { allowed: true, current_value: 0, limit_value: -1, remaining: -1 };
    },
    enabled: !!user,
    staleTime: STALE_TIME,
  });

  const data = query.data;
  const percentage = data && data.limit_value > 0
    ? Math.min(100, Math.round((data.current_value / data.limit_value) * 100))
    : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = data ? !data.allowed : false;

  return {
    current: data?.current_value ?? 0,
    limit: data?.limit_value ?? -1,
    remaining: data?.remaining ?? -1,
    percentage,
    isNearLimit,
    isAtLimit,
    isLoading: query.isLoading,
    isUnlimited: (data?.limit_value ?? -1) < 0,
  };
}
