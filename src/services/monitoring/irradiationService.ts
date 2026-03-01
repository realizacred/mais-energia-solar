/**
 * Irradiation Service — SSOT for daily HSP (Peak Sun Hours).
 * Provides getDailyHsp() with cache lookup + regional premise fallback.
 * Used by PR calculation to replace the hardcoded 4.5 constant.
 */
import { supabase } from "@/integrations/supabase/client";

export interface HspResult {
  hsp_kwh_m2: number | null;
  source: "cache" | "regional_premise" | "national_fallback" | "unavailable";
  confidence: "high" | "medium" | "low" | "none";
}

/** Map latitude to Brazilian region for fallback premises */
function latLonToRegion(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return "brasil";

  // Rough Brazilian region mapping by latitude bands
  // Norte: lat > -5
  // Nordeste: lat -5 to -15, lon > -42
  // Centro-Oeste: lat -5 to -20, lon <= -42
  // Sudeste: lat -15 to -25, lon > -50
  // Sul: lat < -25

  if (lat > -5) return "norte";
  if (lat > -15 && lon != null && lon > -42) return "nordeste";
  if (lat > -20 && lon != null && lon <= -42) return "centro_oeste";
  if (lat > -25) return "sudeste";
  return "sul";
}

/**
 * Get daily HSP for a location, with fallback chain:
 * 1. irradiation_daily_cache (real API data)
 * 2. irradiation_regional_premises (seasonal average by region)
 * 3. National fallback (monthly average for all Brazil)
 */
export async function getDailyHsp(params: {
  lat: number | null;
  lon: number | null;
  date?: Date;
}): Promise<HspResult> {
  const { lat, lon, date = new Date() } = params;
  const dateStr = date.toISOString().slice(0, 10);
  const month = date.getMonth() + 1;

  // 1. Try cache (exact location match within ~0.1° tolerance)
  if (lat != null && lon != null) {
    const { data: cached } = await supabase
      .from("irradiation_daily_cache" as any)
      .select("hsp_kwh_m2, source, confidence")
      .gte("latitude", lat - 0.1)
      .lte("latitude", lat + 0.1)
      .gte("longitude", lon - 0.1)
      .lte("longitude", lon + 0.1)
      .eq("date", dateStr)
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached && (cached as any).hsp_kwh_m2) {
      return {
        hsp_kwh_m2: Number((cached as any).hsp_kwh_m2),
        source: "cache",
        confidence: (cached as any).confidence === "high" ? "high" : "medium",
      };
    }
  }

  // 2. Regional premise fallback
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

  // 3. National fallback
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

  // No HSP data available — never use hardcoded 4.5
  return { hsp_kwh_m2: null, source: "unavailable", confidence: "none" };
}

/**
 * Get average HSP for a date range at a location.
 * Useful for monthly PR calculations.
 */
export async function getMonthlyAvgHsp(params: {
  lat: number | null;
  lon: number | null;
  month?: number;
}): Promise<HspResult> {
  const { lat, lon, month = new Date().getMonth() + 1 } = params;

  // For monthly average, go straight to regional premises
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

  // No HSP data available — never use hardcoded fallback
  return { hsp_kwh_m2: null, source: "unavailable", confidence: "none" };
}
