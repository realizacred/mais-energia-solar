/**
 * Financial & Performance calculations for Solar Monitoring.
 * SSOT for converting energy data into financial savings and PR metrics.
 */
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyAvgHsp, type HspResult } from "./irradiationService";
import { calcExpectedFactor, type PlantLosses } from "./expectedYieldService";
import { calcConfidenceScore } from "./confidenceService";
export interface MonitorFinancials {
  tarifa_kwh: number;
  kg_co2_per_kwh: number;
  savings_today_brl: number;
  savings_month_brl: number;
  co2_avoided_month_kg: number;
}

export type PrStatus =
  | "ok"
  | "no_data"
  | "config_required"
  | "irradiation_unavailable"
  | "timezone_open"
  | "unit_untrusted";

export interface PlantPerformanceRatio {
  plant_id: string;
  plant_name: string;
  installed_kwp: number;
  expected_month_kwh: number;
  actual_month_kwh: number;
  pr_percent: number | null;
  pr_status: PrStatus;
  hsp_used: number | null;
  hsp_source: string;
  hsp_confidence: string;
  expected_factor: number;
  deviation_percent: number;
  confidence_score: number;
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
    shading_loss_percent?: number | null;
    soiling_loss_percent?: number | null;
    other_losses_percent?: number | null;
  }>,
  monthReadings: Array<{
    plant_id: string;
    energy_kwh: number;
    peak_power_kw?: number | null;
  }>
): Promise<PlantPerformanceRatio[]> {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  // Use only completed days — today is still in progress and readings may be 0
  const daysSoFar = Math.max(1, now.getDate() - 1);

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
    if (r.energy_kwh > 0) {
      actualMap.set(r.plant_id, (actualMap.get(r.plant_id) || 0) + r.energy_kwh);
    }
  });

  // Fetch devices to detect offline inverters and adjust effective kWp
  const offlineInfoMap = new Map<string, { offlineCount: number; totalCount: number; offlinePowerKw: number; totalPowerKw: number }>();
  try {
    const plantIds = plants.map((p) => p.id);
    const { data: devices } = await supabase
      .from("monitor_devices")
      .select("plant_id, type, status, metadata")
      .in("plant_id", plantIds)
      .eq("type", "inverter");
    if (devices) {
      for (const d of devices) {
        const info = offlineInfoMap.get(d.plant_id) || { offlineCount: 0, totalCount: 0, offlinePowerKw: 0, totalPowerKw: 0 };
        const ratedPower = Number((d.metadata as any)?.power ?? (d.metadata as any)?.power1 ?? 0);
        info.totalCount++;
        info.totalPowerKw += ratedPower;
        if (d.status === "offline") {
          info.offlineCount++;
          info.offlinePowerKw += ratedPower;
        }
        offlineInfoMap.set(d.plant_id, info);
      }
    }
  } catch { /* proceed without device adjustment */ }

  const results: PlantPerformanceRatio[] = [];

  for (const p of plants) {
    const kwp = p.installed_power_kwp;
    const actual = actualMap.get(p.id) || 0;
    const hspKey = `${p.latitude ?? "null"}_${p.longitude ?? "null"}`;
    const hspResult = hspCache.get(hspKey)!;
    const hsp = hspResult.hsp_kwh_m2;

    // Adjust effective kWp: discount offline inverters proportionally
    const offlineInfo = offlineInfoMap.get(p.id);
    let effectiveKwp = kwp;
    if (kwp && kwp > 0 && offlineInfo && offlineInfo.offlineCount > 0 && offlineInfo.totalCount > 0) {
      if (offlineInfo.totalPowerKw > 0) {
        // Use rated power ratio
        const onlineRatio = Math.max(0, 1 - (offlineInfo.offlinePowerKw / offlineInfo.totalPowerKw));
        effectiveKwp = kwp * onlineRatio;
      } else {
        // Fallback: use count ratio
        const onlineRatio = Math.max(0, 1 - (offlineInfo.offlineCount / offlineInfo.totalCount));
        effectiveKwp = kwp * onlineRatio;
      }
    }

    // Calculate expected factor from plant-specific losses
    const losses: Partial<PlantLosses> = {
      shading_loss_percent: p.shading_loss_percent ?? undefined,
      soiling_loss_percent: p.soiling_loss_percent ?? undefined,
      other_losses_percent: p.other_losses_percent ?? undefined,
    };
    const expectedFactor = calcExpectedFactor(losses);

    // Determine PR status (strict — never fallback to fake data)
    let prStatus: PrStatus = "ok";
    if (!effectiveKwp || effectiveKwp <= 0) {
      prStatus = "config_required";
    } else if (hsp == null || hsp <= 0) {
      prStatus = "irradiation_unavailable";
    } else if (actual <= 0) {
      prStatus = "no_data";
    }

    // Expected energy with losses applied — using effective kWp (excluding offline inverters)
    const canCalc = prStatus === "ok" && effectiveKwp && effectiveKwp > 0 && hsp && hsp > 0;
    const expectedSoFar = canCalc ? effectiveKwp * hsp * daysSoFar * expectedFactor : 0;
    const expectedFull = canCalc ? effectiveKwp * hsp * daysInMonth * expectedFactor : 0;

    // PR = actual / expected * 100 (capped at 120% to flag anomalies)
    const prValue = (canCalc && expectedSoFar > 0)
      ? Math.min((actual / expectedSoFar) * 100, 120)
      : null;

    // Deviation: how much below expected (positive = underperforming)
    const deviationPercent = (canCalc && expectedSoFar > 0)
      ? Math.max(0, ((expectedSoFar - actual) / expectedSoFar) * 100)
      : 0;

    // Confidence score
    const confidence = calcConfidenceScore({
      energyKwh: actual > 0 ? actual : null,
      capacityKwp: kwp,
      hspValue: hsp,
      hspSource: hspResult.source,
      dayIsClosed: true, // monthly aggregation = closed days
      unitIsKwh: true,   // provider adapters normalize to kWh
    });

    results.push({
      plant_id: p.id,
      plant_name: p.name,
      installed_kwp: effectiveKwp || 0,
      expected_month_kwh: Math.round(expectedFull * 10) / 10,
      actual_month_kwh: actual,
      pr_percent: prValue != null ? Math.round(prValue * 10) / 10 : null,
      pr_status: prStatus,
      hsp_used: hsp,
      hsp_source: hspResult.source,
      hsp_confidence: hspResult.confidence,
      expected_factor: Math.round(expectedFactor * 1000) / 1000,
      deviation_percent: Math.round(deviationPercent * 10) / 10,
      confidence_score: confidence.total,
    });
  }

  return results.sort((a, b) => {
    if (a.pr_status === "ok" && b.pr_status !== "ok") return -1;
    if (a.pr_status !== "ok" && b.pr_status === "ok") return 1;
    return (a.pr_percent ?? 0) - (b.pr_percent ?? 0);
  });
}
