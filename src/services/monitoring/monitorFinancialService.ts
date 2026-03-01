/**
 * Financial & Performance calculations for Solar Monitoring.
 * SSOT for converting energy data into financial savings and PR metrics.
 */
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyAvgHsp, type HspResult } from "./irradiationService";

export interface MonitorFinancials {
  tarifa_kwh: number;
  kg_co2_per_kwh: number;
  savings_today_brl: number;
  savings_month_brl: number;
  co2_avoided_month_kg: number;
}

export type PrStatus = "ok" | "no_data" | "config_required" | "irradiation_unavailable";

export interface PlantPerformanceRatio {
  plant_id: string;
  plant_name: string;
  installed_kwp: number;
  expected_month_kwh: number;
  actual_month_kwh: number;
  pr_percent: number;
  pr_status: PrStatus;
  hsp_used: number;
  hsp_source: string;
  hsp_confidence: string;
}

/** Fetch tenant tariff from calculadora_config */
async function getTenantTariff(): Promise<{ tarifa_kwh: number; kg_co2_per_kwh: number }> {
  const { data } = await supabase
    .from("calculadora_config")
    .select("tarifa_media_kwh, kg_co2_por_kwh")
    .limit(1)
    .maybeSingle();

  return {
    tarifa_kwh: (data as any)?.tarifa_media_kwh ?? 0.85,
    kg_co2_per_kwh: (data as any)?.kg_co2_por_kwh ?? 0.084,
  };
}

/** Calculate financial savings from energy data */
export async function getFinancials(
  energyTodayKwh: number,
  energyMonthKwh: number
): Promise<MonitorFinancials> {
  const { tarifa_kwh, kg_co2_per_kwh } = await getTenantTariff();

  return {
    tarifa_kwh,
    kg_co2_per_kwh,
    savings_today_brl: energyTodayKwh * tarifa_kwh,
    savings_month_brl: energyMonthKwh * tarifa_kwh,
    co2_avoided_month_kg: energyMonthKwh * kg_co2_per_kwh,
  };
}

/**
 * Calculate Performance Ratio for each plant using real irradiation data.
 *
 * PR = actual_energy_kwh / (capacity_kwp × HSP × days)
 *
 * HSP fallback chain:
 *  1. irradiation_daily_cache (API/satellite data)
 *  2. irradiation_regional_premises (seasonal by region based on lat/lon)
 *  3. National average for Brazil
 *
 * Validation states prevent false alerts:
 *  - NO_DATA: no energy readings for the plant
 *  - CONFIG_REQUIRED: missing capacity_kwp
 *  - IRRADIATION_UNAVAILABLE: could not determine HSP (should never happen with seed data)
 */
export async function getPerformanceRatios(
  plants: Array<{
    id: string;
    name: string;
    installed_power_kwp: number | null;
    latitude?: number | null;
    longitude?: number | null;
  }>,
  monthReadings: Array<{
    plant_id: string;
    energy_kwh: number;
    peak_power_kw?: number | null;
  }>
): Promise<PlantPerformanceRatio[]> {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysSoFar = now.getDate();

  // Fetch HSP for each unique location
  const hspCache = new Map<string, HspResult>();
  for (const p of plants) {
    const key = `${p.latitude ?? "null"}_${p.longitude ?? "null"}`;
    if (!hspCache.has(key)) {
      const hsp = await getMonthlyAvgHsp({
        lat: p.latitude ?? null,
        lon: p.longitude ?? null,
        month: now.getMonth() + 1,
      });
      hspCache.set(key, hsp);
    }
  }

  // Sum actual generation per plant
  const actualMap = new Map<string, number>();
  monthReadings.forEach((r) => {
    const dailyEnergy = r.energy_kwh;
    if (dailyEnergy && dailyEnergy > 0) {
      actualMap.set(r.plant_id, (actualMap.get(r.plant_id) || 0) + dailyEnergy);
    }
  });

  const results: PlantPerformanceRatio[] = [];

  for (const p of plants) {
    const kwp = p.installed_power_kwp;
    const actual = actualMap.get(p.id) || 0;
    const hspKey = `${p.latitude ?? "null"}_${p.longitude ?? "null"}`;
    const hspResult = hspCache.get(hspKey)!;
    const hsp = hspResult.hsp_kwh_m2;

    // Determine PR status
    let prStatus: PrStatus = "ok";
    if (!kwp || kwp <= 0) {
      prStatus = "config_required";
    } else if (actual <= 0) {
      prStatus = "no_data";
    } else if (!hsp || hsp <= 0) {
      prStatus = "irradiation_unavailable";
    }

    const expectedSoFar = (kwp && kwp > 0 && hsp > 0) ? kwp * hsp * daysSoFar : 0;
    const expectedFull = (kwp && kwp > 0 && hsp > 0) ? kwp * hsp * daysInMonth : 0;
    const pr = (prStatus === "ok" && expectedSoFar > 0)
      ? Math.min((actual / expectedSoFar) * 100, 120) // Cap at 120% to flag anomalies
      : 0;

    results.push({
      plant_id: p.id,
      plant_name: p.name,
      installed_kwp: kwp || 0,
      expected_month_kwh: expectedFull,
      actual_month_kwh: actual,
      pr_percent: Math.round(pr * 10) / 10,
      pr_status: prStatus,
      hsp_used: hsp,
      hsp_source: hspResult.source,
      hsp_confidence: hspResult.confidence,
    });
  }

  return results.sort((a, b) => {
    // Sort: ok status first, then by PR ascending
    if (a.pr_status === "ok" && b.pr_status !== "ok") return -1;
    if (a.pr_status !== "ok" && b.pr_status === "ok") return 1;
    return a.pr_percent - b.pr_percent;
  });
}
