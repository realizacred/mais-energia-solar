import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TenantSubscription {
  subscription_id: string;
  plan_code: string;
  plan_name: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "expired";
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  price_monthly: number;
}

export interface PlanFeature {
  feature_key: string;
  enabled: boolean;
}

export interface PlanLimit {
  limit_key: string;
  limit_value: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  current_value: number;
  limit_value: number;
  remaining: number;
}

export function useTenantPlan() {
  const { user } = useAuth();

  const subscriptionQuery = useQuery({
    queryKey: ["tenant-subscription"],
    queryFn: async (): Promise<TenantSubscription | null> => {
      const { data, error } = await supabase.rpc("get_tenant_subscription");
      if (error) throw error;
      return (data as any)?.[0] ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const featuresQuery = useQuery({
    queryKey: ["tenant-plan-features", subscriptionQuery.data?.plan_code],
    queryFn: async (): Promise<Record<string, boolean>> => {
      const sub = subscriptionQuery.data;
      if (!sub) return {};
      
      const { data, error } = await supabase
        .from("plan_features")
        .select("feature_key, enabled, plans!inner(code)")
        .eq("plans.code", sub.plan_code);
      
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((f: any) => { map[f.feature_key] = f.enabled; });
      return map;
    },
    enabled: !!subscriptionQuery.data,
    staleTime: 10 * 60 * 1000,
  });

  const limitsQuery = useQuery({
    queryKey: ["tenant-plan-limits", subscriptionQuery.data?.plan_code],
    queryFn: async (): Promise<Record<string, number>> => {
      const sub = subscriptionQuery.data;
      if (!sub) return {};
      
      const { data, error } = await supabase
        .from("plan_limits")
        .select("limit_key, limit_value, plans!inner(code)")
        .eq("plans.code", sub.plan_code);
      
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((l: any) => { map[l.limit_key] = l.limit_value; });
      return map;
    },
    enabled: !!subscriptionQuery.data,
    staleTime: 10 * 60 * 1000,
  });

  const subscription = subscriptionQuery.data ?? null;

  const isTrialing = subscription?.status === "trialing";
  const isActive = subscription?.status === "active" || isTrialing;
  const isPastDue = subscription?.status === "past_due";
  const isCanceled = subscription?.status === "canceled" || subscription?.status === "expired";

  const trialDaysRemaining = (() => {
    if (!isTrialing || !subscription?.trial_ends_at) return 0;
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const hasFeature = (key: string): boolean => {
    return featuresQuery.data?.[key] ?? false;
  };

  const getLimit = (key: string): number | null => {
    return limitsQuery.data?.[key] ?? null;
  };

  const checkLimit = async (metricKey: string, delta = 1): Promise<LimitCheckResult> => {
    const { data, error } = await supabase.rpc("check_tenant_limit", {
      _metric_key: metricKey,
      _delta: delta,
    });
    if (error) throw error;
    const row = (data as any)?.[0];
    return row ?? { allowed: true, current_value: 0, limit_value: -1, remaining: -1 };
  };

  const incrementUsage = async (metricKey: string, delta = 1, source?: string) => {
    const { error } = await supabase.rpc("increment_usage", {
      _metric_key: metricKey,
      _delta: delta,
      _source: source ?? null,
    });
    if (error) throw error;
  };

  const enforceLimit = async (metricKey: string, delta = 1): Promise<LimitCheckResult> => {
    const result = await checkLimit(metricKey, delta);
    if (!result.allowed) {
      throw new PlanLimitError(metricKey, result.current_value, result.limit_value);
    }
    return result;
  };

  return {
    subscription,
    features: featuresQuery.data ?? {},
    limits: limitsQuery.data ?? {},
    loading: subscriptionQuery.isLoading,
    isTrialing,
    isActive,
    isPastDue,
    isCanceled,
    trialDaysRemaining,
    hasFeature,
    getLimit,
    checkLimit,
    incrementUsage,
    enforceLimit,
  };
}

export class PlanLimitError extends Error {
  public metricKey: string;
  public currentValue: number;
  public limitValue: number;

  constructor(metricKey: string, currentValue: number, limitValue: number) {
    super(`Limite do plano atingido: ${metricKey} (${currentValue}/${limitValue})`);
    this.name = "PlanLimitError";
    this.metricKey = metricKey;
    this.currentValue = currentValue;
    this.limitValue = limitValue;
  }
}
