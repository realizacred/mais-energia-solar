import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MIN_WEIGHT = 10;
const MAX_ADJUSTMENT = 0.20; // ±20%
const MIN_VIEWS_THRESHOLD = 5; // Need at least 5 views to consider

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get all active variants grouped by plan
    const { data: variants, error: vErr } = await supabase
      .from("price_variants")
      .select("id, plan_id, name, weight, is_active")
      .eq("is_active", true)
      .order("plan_id");

    if (vErr) throw vErr;
    if (!variants?.length) {
      return new Response(
        JSON.stringify({ message: "No active variants to optimize" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Get tracking events for conversion data
    const { data: events } = await supabase
      .from("audit_feature_access_log")
      .select("feature_key, reason")
      .in("feature_key", ["plan_view", "plan_upgrade"]);

    const viewsByVariant = new Map<string, number>();
    const upgradesByVariant = new Map<string, number>();

    (events ?? []).forEach((e: any) => {
      const vid = e.reason?.replace("variant:", "") ?? "";
      if (!vid) return;
      if (e.feature_key === "plan_view") {
        viewsByVariant.set(vid, (viewsByVariant.get(vid) ?? 0) + 1);
      } else if (e.feature_key === "plan_upgrade") {
        upgradesByVariant.set(vid, (upgradesByVariant.get(vid) ?? 0) + 1);
      }
    });

    // 3. Group by plan_id
    const planGroups = new Map<string, typeof variants>();
    variants.forEach((v) => {
      if (!planGroups.has(v.plan_id)) planGroups.set(v.plan_id, []);
      planGroups.get(v.plan_id)!.push(v);
    });

    const historyInserts: any[] = [];
    const updates: { id: string; weight: number }[] = [];

    for (const [planId, group] of planGroups) {
      if (group.length < 2) continue; // Nothing to optimize with single variant

      // Calculate conversion rates
      const rated = group.map((v) => {
        const views = viewsByVariant.get(v.id) ?? 0;
        const upgrades = upgradesByVariant.get(v.id) ?? 0;
        const conversionRate = views >= MIN_VIEWS_THRESHOLD ? upgrades / views : 0;
        return { ...v, views, upgrades, conversionRate };
      });

      // Sort by conversion rate descending
      rated.sort((a, b) => b.conversionRate - a.conversionRate);

      // Adjust weights: top gets boost, bottom gets reduction, middle stays
      const newWeights = rated.map((v, idx) => {
        let factor = 1;
        if (idx === 0 && v.conversionRate > 0) {
          factor = 1 + MAX_ADJUSTMENT; // +20%
        } else if (idx === rated.length - 1) {
          factor = 1 - MAX_ADJUSTMENT; // -20%
        }
        return {
          ...v,
          rawWeight: Math.max(MIN_WEIGHT, Math.round(v.weight * factor)),
        };
      });

      // Normalize to sum = 100
      const totalRaw = newWeights.reduce((s, w) => s + w.rawWeight, 0);
      const normalized = newWeights.map((w) => ({
        ...w,
        normalizedWeight: Math.max(
          MIN_WEIGHT,
          Math.round((w.rawWeight / totalRaw) * 100),
        ),
      }));

      // Ensure sum is exactly 100
      const sum = normalized.reduce((s, w) => s + w.normalizedWeight, 0);
      if (sum !== 100 && normalized.length > 0) {
        normalized[0].normalizedWeight += 100 - sum;
      }

      for (const v of normalized) {
        if (v.normalizedWeight !== v.weight) {
          updates.push({ id: v.id, weight: v.normalizedWeight });
          historyInserts.push({
            variant_id: v.id,
            old_weight: v.weight,
            new_weight: v.normalizedWeight,
            conversion_rate: v.conversionRate,
            views: v.views,
            upgrades: v.upgrades,
          });
        }
      }
    }

    // 4. Apply updates
    for (const u of updates) {
      await supabase
        .from("price_variants")
        .update({ weight: u.weight })
        .eq("id", u.id);
    }

    // 5. Save history
    if (historyInserts.length > 0) {
      await supabase.from("price_variant_history").insert(historyInserts);
    }

    // 6. Log the optimization event
    await supabase.from("audit_feature_access_log").insert({
      feature_key: "pricing_optimized",
      access_result: "success",
      reason: `Updated ${updates.length} variants`,
    });

    return new Response(
      JSON.stringify({
        message: "Pricing weights optimized",
        variants_updated: updates.length,
        history_entries: historyInserts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[optimize-pricing-weights] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
