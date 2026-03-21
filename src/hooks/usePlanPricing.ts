/**
 * usePlanPricing — Resolve price variants for all active plans.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { resolvePriceVariant } from "@/services/pricingVariantService";
import { usePublicPlans, type PublicPlan } from "@/hooks/usePublicPlans";

const STALE_TIME = 1000 * 60 * 10;

export interface PricedPlan extends PublicPlan {
  resolved_price_monthly: number;
  resolved_price_yearly: number | null;
  variant_id: string | null;
  variant_name: string | null;
}

export function usePlanPricing() {
  const { data: plans = [], isLoading: plansLoading } = usePublicPlans();

  const pricingQuery = useQuery({
    queryKey: ["plan-pricing-variants", plans.map((p) => p.id).join(",")],
    queryFn: async (): Promise<PricedPlan[]> => {
      const { tenantId } = await getCurrentTenantId();

      const results: PricedPlan[] = [];
      for (const plan of plans) {
        const variant = await resolvePriceVariant(tenantId, plan.id);
        results.push({
          ...plan,
          resolved_price_monthly: variant?.price_monthly ?? plan.price_monthly,
          resolved_price_yearly: variant?.price_yearly ?? plan.price_yearly,
          variant_id: variant?.id ?? null,
          variant_name: variant?.name ?? null,
        });
      }
      return results;
    },
    enabled: plans.length > 0,
    staleTime: STALE_TIME,
  });

  return {
    data: pricingQuery.data ?? [],
    isLoading: plansLoading || pricingQuery.isLoading,
  };
}

/**
 * Track pricing events via audit_feature_access_log.
 */
export async function trackPricingEvent(
  eventType: "plan_view" | "plan_click" | "plan_upgrade",
  planId: string,
  variantId: string | null,
) {
  try {
    const { tenantId, userId } = await getCurrentTenantId();
    await supabase.from("audit_feature_access_log").insert({
      feature_key: eventType,
      access_result: eventType.split("_").pop() ?? eventType,
      reason: variantId ? `variant:${variantId}` : null,
      tenant_id: tenantId,
      user_id: userId,
    });
  } catch (err) {
    console.warn("[pricing-tracking] Failed:", err);
  }
}
