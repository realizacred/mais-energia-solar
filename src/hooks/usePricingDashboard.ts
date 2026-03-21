/**
 * usePricingDashboard — Metrics for pricing A/B test dashboard.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface VariantMetrics {
  variant_id: string;
  variant_name: string;
  plan_name: string;
  plan_id: string;
  price_monthly: number;
  is_active: boolean;
  weight: number;
  views: number;
  clicks: number;
  upgrades: number;
  conversion_rate: number;
  tenants_assigned: number;
}

export function usePricingDashboard() {
  return useQuery({
    queryKey: ["pricing-dashboard-metrics"],
    queryFn: async (): Promise<VariantMetrics[]> => {
      // Fetch all variants with plan info
      const { data: variants, error: vErr } = await supabase
        .from("price_variants")
        .select("id, plan_id, name, price_monthly, is_active, weight, plans(name)")
        .order("created_at", { ascending: true });

      if (vErr) throw vErr;
      if (!variants?.length) return [];

      // Fetch tenant assignments count
      const { data: assignments } = await supabase
        .from("tenant_price_variant")
        .select("variant_id");

      const assignmentCounts = new Map<string, number>();
      (assignments ?? []).forEach((a: any) => {
        assignmentCounts.set(a.variant_id, (assignmentCounts.get(a.variant_id) ?? 0) + 1);
      });

      // Fetch tracking events
      const { data: events } = await supabase
        .from("audit_feature_access_log")
        .select("feature_key, access_result, reason")
        .in("feature_key", ["plan_view", "plan_click", "plan_upgrade"]);

      const variantViews = new Map<string, number>();
      const variantClicks = new Map<string, number>();
      const variantUpgrades = new Map<string, number>();

      (events ?? []).forEach((e: any) => {
        const vid = e.reason?.replace("variant:", "") ?? "";
        if (!vid) return;
        if (e.feature_key === "plan_view") {
          variantViews.set(vid, (variantViews.get(vid) ?? 0) + 1);
        } else if (e.feature_key === "plan_click") {
          variantClicks.set(vid, (variantClicks.get(vid) ?? 0) + 1);
        } else if (e.feature_key === "plan_upgrade") {
          variantUpgrades.set(vid, (variantUpgrades.get(vid) ?? 0) + 1);
        }
      });

      return variants.map((v: any) => {
        const views = variantViews.get(v.id) ?? 0;
        const clicks = variantClicks.get(v.id) ?? 0;
        const upgrades = variantUpgrades.get(v.id) ?? 0;
        return {
          variant_id: v.id,
          variant_name: v.name,
          plan_name: v.plans?.name ?? "—",
          plan_id: v.plan_id,
          price_monthly: Number(v.price_monthly),
          is_active: v.is_active,
          weight: v.weight,
          views,
          clicks,
          upgrades,
          conversion_rate: views > 0 ? (upgrades / views) * 100 : 0,
          tenants_assigned: assignmentCounts.get(v.id) ?? 0,
        };
      });
    },
    staleTime: STALE_TIME,
  });
}
