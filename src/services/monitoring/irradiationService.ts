/**
 * Irradiation Service — SSOT for HSP (Peak Sun Hours) used in PR calculations.
 *
 * STRATEGY:
 *   TIER 1: irradiance-provider (Atlas INPE + NSRDB — real data per lat/lon)
 *   TIER 2: irradiation_regional_premises (seasonal average by region)
 *   TIER 3: National fallback (monthly average for all Brazil)
 *
 * This bridges the meteorologia base (irradiance-provider) with the monitoring engine.
 */
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyIrradiance } from "@/services/irradiance-provider";

export interface HspResult {
  hsp_kwh_m2: number | null;
  source: "atlas_inpe" | "nsrdb" | "cache" | "regional_premise" | "national_fallback" | "unavailable";
  confidence: "high" | "medium" | "low" | "none";
}

/** Map latitude to Brazilian region for fallback premises */
function latLonToRegion(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return "brasil";
  if (lat > -5) return "norte";
  if (lat > -15 && lon > -42) return "nordeste";
  if (lat > -20 && lon <= -42) return "centro_oeste";
  if (lat > -25) return "sudeste";
  return "sul";
}

/**
 * Get the month key (m01..m12) from a 1-based month number.
 */
function monthKey(month: number): string {
  return `m${String(month).padStart(2, "0")}`;
}

/**
 * Try to get HSP from the irradiance-provider (Atlas INPE + NSRDB).
 * Returns the daily average for the requested month.
 */
async function tryIrradianceProvider(
  lat: number,
  lon: number,
  month: number
): Promise<HspResult | null> {
  try {
    const result = await getMonthlyIrradiance({ lat, lon });
    const key = monthKey(month) as keyof typeof result.series;
    const hsp = result.series[key];

    if (hsp && hsp > 0) {
      const sourceLabel = result.source === "nsrdb" ? "nsrdb" as const : "atlas_inpe" as const;
      return {
        hsp_kwh_m2: Math.round(hsp * 100) / 100,
        source: result.cache_hit ? "cache" : sourceLabel,
        confidence: "high",
      };
    }
    return null;
  } catch (e: any) {
    console.warn("[IrradiationService] irradiance-provider failed:", e.message);
    return null;
  }
}

/**
 * Regional premise fallback (TIER 2/3).
 */
async function tryRegionalFallback(
  lat: number | null,
  lon: number | null,
  month: number
): Promise<HspResult> {
  const region = latLonToRegion(lat, lon);

  const { data: premise } = await supabase
    .from("irradiation_regional_premises" as any)
    .select("hsp_kwh_m2")
    .eq("region", region)
    .eq("month", month)
    .maybeSingle();

  if (premise && (premise as any).hsp_kwh_m2) {
    return {
      hsp_kwh_m2: Number((premise as any).hsp_kwh_m2),
      source: "regional_premise",
      confidence: "medium",
    };
  }

  // National fallback
  const { data: national } = await supabase
    .from("irradiation_regional_premises" as any)
    .select("hsp_kwh_m2")
    .eq("region", "brasil")
    .eq("month", month)
    .maybeSingle();

  if (national && (national as any).hsp_kwh_m2) {
    return {
      hsp_kwh_m2: Number((national as any).hsp_kwh_m2),
      source: "national_fallback",
      confidence: "low",
    };
  }

  return { hsp_kwh_m2: null, source: "unavailable", confidence: "none" };
}

/**
 * Get daily HSP for a location with full fallback chain.
 * TIER 1: Atlas INPE / NSRDB (real data per lat/lon)
 * TIER 2: Regional premise
 * TIER 3: National fallback
 */
export async function getDailyHsp(params: {
  lat: number | null;
  lon: number | null;
  date?: Date;
}): Promise<HspResult> {
  const { lat, lon, date = new Date() } = params;
  const month = date.getMonth() + 1;

  // TIER 1: Try real irradiance data
  if (lat != null && lon != null) {
    const providerResult = await tryIrradianceProvider(lat, lon, month);
    if (providerResult) return providerResult;
  }

  // TIER 2/3: Regional/national fallback
  return tryRegionalFallback(lat, lon, month);
}

/**
 * Get average HSP for a month at a location.
 * Used for monthly PR calculations.
 */
export async function getMonthlyAvgHsp(params: {
  lat: number | null;
  lon: number | null;
  month?: number;
}): Promise<HspResult> {
  const { lat, lon, month = new Date().getMonth() + 1 } = params;

  // TIER 1: Try real irradiance data
  if (lat != null && lon != null) {
    const providerResult = await tryIrradianceProvider(lat, lon, month);
    if (providerResult) return providerResult;
  }

  // TIER 2/3: Regional/national fallback
  return tryRegionalFallback(lat, lon, month);
}
