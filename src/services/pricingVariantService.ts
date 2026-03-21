/**
 * pricingVariantService — Resolve price variant for a tenant+plan.
 * Sticky assignment: once assigned, always returns same variant.
 */
import { supabase } from "@/integrations/supabase/client";

interface PriceVariant {
  id: string;
  plan_id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  weight: number;
}

/**
 * Weighted random selection from active variants.
 */
function pickByWeight(variants: PriceVariant[]): PriceVariant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const v of variants) {
    rand -= v.weight;
    if (rand <= 0) return v;
  }
  return variants[variants.length - 1];
}

/**
 * Resolve the price variant for a specific tenant+plan.
 * 1. Check existing assignment
 * 2. If none, pick weighted random and persist
 * 3. Return variant pricing
 */
export async function resolvePriceVariant(
  tenantId: string,
  planId: string,
): Promise<PriceVariant | null> {
  // 1. Check existing sticky assignment
  const { data: existing } = await supabase
    .from("tenant_price_variant")
    .select("variant_id, price_variants(id, plan_id, name, price_monthly, price_yearly, weight)")
    .eq("tenant_id", tenantId)
    .eq("plan_id", planId)
    .maybeSingle();

  if (existing?.price_variants) {
    const v = existing.price_variants as any;
    return {
      id: v.id,
      plan_id: v.plan_id,
      name: v.name,
      price_monthly: Number(v.price_monthly),
      price_yearly: v.price_yearly != null ? Number(v.price_yearly) : null,
      weight: v.weight,
    };
  }

  // 2. Fetch active variants for this plan
  const { data: variants, error } = await supabase
    .from("price_variants")
    .select("id, plan_id, name, price_monthly, price_yearly, weight")
    .eq("plan_id", planId)
    .eq("is_active", true);

  if (error || !variants?.length) return null;

  const mapped: PriceVariant[] = variants.map((v: any) => ({
    id: v.id,
    plan_id: v.plan_id,
    name: v.name,
    price_monthly: Number(v.price_monthly),
    price_yearly: v.price_yearly != null ? Number(v.price_yearly) : null,
    weight: v.weight,
  }));

  // 3. Pick and persist
  const picked = mapped.length === 1 ? mapped[0] : pickByWeight(mapped);

  await supabase.from("tenant_price_variant").insert({
    tenant_id: tenantId,
    plan_id: planId,
    variant_id: picked.id,
  });

  return picked;
}
