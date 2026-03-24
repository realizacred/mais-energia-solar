/**
 * useGdDashboardData — Hook for consolidated GD dashboard data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 *
 * Resolves generation + consumption from real data sources
 * (invoices, monitoring, meters) with confidence levels.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveGeneration,
  resolveConsumption,
  getSimulationBaseline,
  type GdGroupDataSources,
  type ResolvedDataSource,
  type UcConsumptionData,
} from "@/services/energia/dataSourceResolverService";

const STALE_TIME = 1000 * 60 * 2; // 2 min — operational data

interface GdDashboardDataInput {
  groupId: string | null;
  ucGeradoraId: string | null;
  beneficiaryUcIds: string[];
  year: number;
  month: number;
}

export interface GdDashboardResolvedData extends GdGroupDataSources {
  isReady: boolean;
}

/**
 * Fetches all data sources and resolves generation + consumption
 * for the GD decision dashboard.
 */
export function useGdDashboardData(input: GdDashboardDataInput) {
  const { groupId, ucGeradoraId, beneficiaryUcIds, year, month } = input;
  const allUcIds = ucGeradoraId
    ? [ucGeradoraId, ...beneficiaryUcIds]
    : beneficiaryUcIds;

  return useQuery({
    queryKey: ["gd_dashboard_data", groupId, ucGeradoraId, beneficiaryUcIds.join(","), year, month],
    queryFn: async (): Promise<GdDashboardResolvedData> => {
      if (!ucGeradoraId) {
        return emptyResult();
      }

      // ── Fetch invoices for all UCs (last 6 months) ──
      const invoiceData = await fetchInvoicesForUcs(allUcIds, year, month, 6);

      // ── Fetch monitoring data for geradora ──
      const monitoringData = await fetchMonitoringForUc(ucGeradoraId, year, month);

      // ── Fetch meter data for geradora ──
      const meterData = await fetchMeterForUc(ucGeradoraId, year, month);

      // ── Resolve generation ──
      const geradoraInvoices = invoiceData.get(ucGeradoraId) || [];
      const geradoraInvoiceThisMonth = geradoraInvoices.find(
        (i) => i.year === year && i.month === month
      );

      const generation = resolveGeneration({
        meterExportKwh: meterData.exportKwh,
        monitoringKwh: monitoringData.energyKwh,
        invoiceInjectedKwh: geradoraInvoiceThisMonth?.injectedKwh ?? null,
        monitoringDaysCount: monitoringData.daysCount,
        monthDays: new Date(year, month, 0).getDate(),
      });

      // ── Resolve generator consumption ──
      const generatorConsumption = resolveConsumption(
        geradoraInvoices.map((i) => ({ year: i.year, month: i.month, kwh: i.consumedKwh })),
        year,
        month
      );

      // ── Resolve beneficiary consumption ──
      const beneficiaryConsumption: UcConsumptionData[] = beneficiaryUcIds.map((ucId) => {
        const invoices = invoiceData.get(ucId) || [];
        const invoiceMonths = invoices.map((i) => ({
          year: i.year,
          month: i.month,
          kwh: i.consumedKwh,
        }));
        const resolved = resolveConsumption(invoiceMonths, year, month);

        return { ucId, resolved, invoiceMonths };
      });

      return {
        generation,
        generatorConsumption,
        beneficiaryConsumption,
        isReady: true,
      };
    },
    staleTime: STALE_TIME,
    enabled: !!groupId && !!ucGeradoraId && year > 0 && month > 0,
  });
}

// ─── Data Fetchers ──────────────────────────────────────────────

interface InvoiceRow {
  year: number;
  month: number;
  consumedKwh: number;
  injectedKwh: number;
  compensatedKwh: number;
  totalAmount: number;
}

async function fetchInvoicesForUcs(
  ucIds: string[],
  year: number,
  month: number,
  monthsBack: number
): Promise<Map<string, InvoiceRow[]>> {
  if (ucIds.length === 0) return new Map();

  // Calculate date range for lookback
  let startYear = year;
  let startMonth = month - monthsBack;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear--;
  }

  const { data, error } = await supabase
    .from("unit_invoices")
    .select("unit_id, reference_year, reference_month, energy_consumed_kwh, energy_injected_kwh, compensated_kwh, total_amount")
    .in("unit_id", ucIds)
    .or(
      `and(reference_year.gt.${startYear},reference_year.lte.${year}),` +
      `and(reference_year.eq.${startYear},reference_month.gte.${startMonth})`
    )
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false });

  if (error) {
    console.error("[useGdDashboardData] Invoice fetch error:", error);
    return new Map();
  }

  const result = new Map<string, InvoiceRow[]>();
  for (const row of data || []) {
    const ucId = row.unit_id;
    if (!result.has(ucId)) result.set(ucId, []);
    result.get(ucId)!.push({
      year: row.reference_year,
      month: row.reference_month,
      consumedKwh: Number(row.energy_consumed_kwh ?? 0),
      injectedKwh: Number(row.energy_injected_kwh ?? 0),
      compensatedKwh: Number(row.compensated_kwh ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
    });
  }
  return result;
}

async function fetchMonitoringForUc(
  ucId: string,
  year: number,
  month: number
): Promise<{ energyKwh: number | null; daysCount: number }> {
  // Find plant linked to UC
  const { data: plantLinks } = await (supabase as any)
    .from("unit_plant_links")
    .select("plant_id")
    .eq("unit_id", ucId)
    .eq("is_active", true);

  if (!plantLinks || plantLinks.length === 0) {
    return { energyKwh: null, daysCount: 0 };
  }

  const plantIds = plantLinks.map((l: any) => l.plant_id);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  const { data: readings } = await (supabase as any)
    .from("monitor_readings_daily")
    .select("energy_kwh")
    .in("plant_id", plantIds)
    .gte("date", startDate)
    .lte("date", endDate);

  if (!readings || readings.length === 0) {
    return { energyKwh: null, daysCount: 0 };
  }

  let total = 0;
  let daysCount = 0;
  for (const r of readings) {
    const val = Number(r.energy_kwh);
    if (!isNaN(val) && val > 0) {
      total += val;
      daysCount++;
    }
  }

  return {
    energyKwh: total > 0 ? Math.round(total * 100) / 100 : null,
    daysCount,
  };
}

async function fetchMeterForUc(
  ucId: string,
  year: number,
  month: number
): Promise<{ exportKwh: number | null; importKwh: number | null }> {
  // Find active meter linked to UC
  const { data: links } = await (supabase as any)
    .from("unit_meter_links")
    .select("meter_device_id")
    .eq("unit_id", ucId)
    .eq("is_active", true);

  if (!links || links.length === 0) {
    return { exportKwh: null, importKwh: null };
  }

  const meterIds = links.map((l: any) => l.meter_device_id);
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 1).toISOString();

  const { data: readings } = await (supabase as any)
    .from("meter_readings")
    .select("energy_export_kwh, energy_import_kwh, meter_device_id")
    .in("meter_device_id", meterIds)
    .gte("measured_at", startDate)
    .lt("measured_at", endDate)
    .order("measured_at", { ascending: false });

  if (!readings || readings.length === 0) {
    return { exportKwh: null, importKwh: null };
  }

  // Calculate delta (max - min) for cumulative meters
  const exports: number[] = [];
  const imports: number[] = [];
  for (const r of readings) {
    const exp = Number(r.energy_export_kwh);
    const imp = Number(r.energy_import_kwh);
    if (!isNaN(exp) && exp > 0) exports.push(exp);
    if (!isNaN(imp) && imp > 0) imports.push(imp);
  }

  const exportKwh = exports.length >= 2
    ? Math.round((Math.max(...exports) - Math.min(...exports)) * 100) / 100
    : null;

  const importKwh = imports.length >= 2
    ? Math.round((Math.max(...imports) - Math.min(...imports)) * 100) / 100
    : null;

  return { exportKwh, importKwh };
}

function emptyResult(): GdDashboardResolvedData {
  return {
    generation: { value: 0, source: "none", confidence: "low", label: "Sem dados" },
    generatorConsumption: { value: 0, source: "none", confidence: "low", label: "Sem dados" },
    beneficiaryConsumption: [],
    isReady: false,
  };
}
