/**
 * faturaVsMedidorService — Cross-validation between invoice and meter readings.
 * Compares energy_consumed_kwh / energy_injected_kwh from unit_invoices
 * with aggregated energy_import_kwh / energy_export_kwh from meter_readings_daily.
 */
import { supabase } from "@/integrations/supabase/client";

export type ValidationStatus = "ok" | "atencao" | "critico";

export interface FaturaVsMedidorResult {
  status: ValidationStatus;
  consumo_fatura: number;
  consumo_medidor: number;
  injecao_fatura: number;
  injecao_medidor: number;
  divergencia_consumo_percent: number;
  divergencia_injecao_percent: number;
  has_meter: boolean;
  has_invoice: boolean;
}

function calcDivergence(faturaVal: number, medidorVal: number): number {
  if (faturaVal === 0 && medidorVal === 0) return 0;
  if (faturaVal === 0) return 100;
  return Math.round(Math.abs(faturaVal - medidorVal) / faturaVal * 100 * 100) / 100;
}

function classifyStatus(consumoDiv: number, injecaoDiv: number): ValidationStatus {
  const maxDiv = Math.max(consumoDiv, injecaoDiv);
  if (maxDiv < 5) return "ok";
  if (maxDiv <= 15) return "atencao";
  return "critico";
}

/**
 * Compare invoice data vs meter readings for a given UC and reference month/year.
 * Returns null if no meter is linked to the UC.
 */
export async function compareFaturaVsMedidor(
  unitId: string,
  referenceMonth: number,
  referenceYear: number
): Promise<FaturaVsMedidorResult> {
  // 1. Get linked meter for this UC
  const { data: link } = await supabase
    .from("unit_meter_links")
    .select("meter_device_id")
    .eq("unit_id", unitId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!link?.meter_device_id) {
    return {
      status: "ok",
      consumo_fatura: 0,
      consumo_medidor: 0,
      injecao_fatura: 0,
      injecao_medidor: 0,
      divergencia_consumo_percent: 0,
      divergencia_injecao_percent: 0,
      has_meter: false,
      has_invoice: false,
    };
  }

  // 2. Get invoice for the period
  const { data: invoice } = await supabase
    .from("unit_invoices")
    .select("energy_consumed_kwh, energy_injected_kwh")
    .eq("unit_id", unitId)
    .eq("reference_month", referenceMonth)
    .eq("reference_year", referenceYear)
    .limit(1)
    .maybeSingle();

  const consumoFatura = invoice?.energy_consumed_kwh ?? 0;
  const injecaoFatura = invoice?.energy_injected_kwh ?? 0;

  // 3. Get meter readings for the period
  const startDate = `${referenceYear}-${String(referenceMonth).padStart(2, "0")}-01`;
  const endMonth = referenceMonth === 12 ? 1 : referenceMonth + 1;
  const endYear = referenceMonth === 12 ? referenceYear + 1 : referenceYear;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const { data: readings } = await (supabase as any)
    .from("meter_readings_daily")
    .select("energy_import_kwh, energy_export_kwh")
    .eq("meter_device_id", link.meter_device_id)
    .gte("reading_date", startDate)
    .lt("reading_date", endDate);

  const consumoMedidor = (readings || []).reduce(
    (sum: number, r: any) => sum + (r.energy_import_kwh || 0), 0
  );
  const injecaoMedidor = (readings || []).reduce(
    (sum: number, r: any) => sum + (r.energy_export_kwh || 0), 0
  );

  const divConsumo = calcDivergence(consumoFatura, consumoMedidor);
  const divInjecao = calcDivergence(injecaoFatura, injecaoMedidor);

  return {
    status: classifyStatus(divConsumo, divInjecao),
    consumo_fatura: consumoFatura,
    consumo_medidor: Math.round(consumoMedidor * 10) / 10,
    injecao_fatura: injecaoFatura,
    injecao_medidor: Math.round(injecaoMedidor * 10) / 10,
    divergencia_consumo_percent: divConsumo,
    divergencia_injecao_percent: divInjecao,
    has_meter: true,
    has_invoice: !!invoice,
  };
}
