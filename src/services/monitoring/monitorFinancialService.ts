/**
 * Financial & Performance calculations for Solar Monitoring.
 * SSOT for converting energy data into financial savings and PR metrics.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MonitorFinancials {
  tarifa_kwh: number;
  kg_co2_per_kwh: number;
  savings_today_brl: number;
  savings_month_brl: number;
  co2_avoided_month_kg: number;
}

export interface PlantPerformanceRatio {
  plant_id: string;
  plant_name: string;
  installed_kwp: number;
  expected_month_kwh: number;
  actual_month_kwh: number;
  pr_percent: number;
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
 * Calculate Performance Ratio for each plant.
 * PR = Actual Generation / Expected Generation
 * Expected = installed_kwp * avg_sun_hours_per_day * days_in_month
 * Using 4.5 peak sun hours as BR average.
 */
export async function getPerformanceRatios(
  plants: Array<{ id: string; name: string; installed_power_kwp: number | null }>,
  monthReadings: Array<{ plant_id: string; energy_kwh: number }>
): Promise<PlantPerformanceRatio[]> {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysSoFar = now.getDate();
  const AVG_SUN_HOURS = 4.5;

  // Sum actual generation per plant
  const actualMap = new Map<string, number>();
  monthReadings.forEach((r) => {
    actualMap.set(r.plant_id, (actualMap.get(r.plant_id) || 0) + r.energy_kwh);
  });

  return plants
    .filter((p) => p.installed_power_kwp && p.installed_power_kwp > 0)
    .map((p) => {
      const kwp = p.installed_power_kwp!;
      const expectedFull = kwp * AVG_SUN_HOURS * daysInMonth;
      const expectedSoFar = kwp * AVG_SUN_HOURS * daysSoFar;
      const actual = actualMap.get(p.id) || 0;
      const pr = expectedSoFar > 0 ? (actual / expectedSoFar) * 100 : 0;

      return {
        plant_id: p.id,
        plant_name: p.name,
        installed_kwp: kwp,
        expected_month_kwh: expectedFull,
        actual_month_kwh: actual,
        pr_percent: Math.round(pr * 10) / 10,
      };
    })
    .sort((a, b) => a.pr_percent - b.pr_percent);
}
