/**
 * usePublicPlans — Fetch plans with features and limits for client-facing page.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 10;

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  is_popular: boolean;
  sort_order: number;
  features: { feature_key: string; enabled: boolean }[];
  limits: { limit_key: string; limit_value: number }[];
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ["public-plans-with-details"],
    queryFn: async (): Promise<PublicPlan[]> => {
      const { data: plans, error: pErr } = await supabase
        .from("plans")
        .select("id, code, name, description, price_monthly, price_yearly, is_popular, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (pErr) throw pErr;
      if (!plans?.length) return [];

      const planIds = plans.map((p) => p.id);

      const [featRes, limRes] = await Promise.all([
        supabase
          .from("plan_features")
          .select("plan_id, feature_key, enabled")
          .in("plan_id", planIds),
        supabase
          .from("plan_limits")
          .select("plan_id, limit_key, limit_value")
          .in("plan_id", planIds),
      ]);

      if (featRes.error) throw featRes.error;
      if (limRes.error) throw limRes.error;

      const featMap = new Map<string, { feature_key: string; enabled: boolean }[]>();
      (featRes.data ?? []).forEach((f) => {
        if (!featMap.has(f.plan_id)) featMap.set(f.plan_id, []);
        featMap.get(f.plan_id)!.push({ feature_key: f.feature_key, enabled: f.enabled });
      });

      const limMap = new Map<string, { limit_key: string; limit_value: number }[]>();
      (limRes.data ?? []).forEach((l) => {
        if (!limMap.has(l.plan_id)) limMap.set(l.plan_id, []);
        limMap.get(l.plan_id)!.push({ limit_key: l.limit_key, limit_value: l.limit_value });
      });

      return plans.map((p) => ({
        ...p,
        is_popular: (p as any).is_popular ?? false,
        features: featMap.get(p.id) ?? [],
        limits: limMap.get(p.id) ?? [],
      }));
    },
    staleTime: STALE_TIME,
  });
}
