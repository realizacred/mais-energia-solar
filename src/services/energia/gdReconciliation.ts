/**
 * gdReconciliation — Compares meter, monitoring, and invoice generation sources.
 * SSOT for reconciliation status: ok (<5%), warning (5-15%), critical (>15%).
 */
import { supabase } from "@/integrations/supabase/client";

export type ReconciliationStatus = "ok" | "warning" | "critical";

export interface ReconciliationResult {
  meter_kwh: number | null;
  monitoring_kwh: number | null;
  invoice_kwh: number | null;
  selected_source: string;
  diff_percent: number;
  status: ReconciliationStatus;
  notes: string | null;
}

/**
 * Calculate the max divergence % between available sources.
 */
function calcDiffPercent(values: number[]): number {
  if (values.length < 2) return 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === 0) return 0;
  return Math.round(((max - min) / max) * 100 * 100) / 100;
}

function classifyStatus(diff: number): ReconciliationStatus {
  if (diff < 5) return "ok";
  if (diff <= 15) return "warning";
  return "critical";
}

/**
 * Build reconciliation record from the three source functions.
 * Called after the main engine calculates.
 */
export function buildReconciliation(
  meterKwh: number | null,
  monitoringKwh: number | null,
  invoiceKwh: number | null,
  selectedSource: string
): ReconciliationResult {
  const available = [meterKwh, monitoringKwh, invoiceKwh].filter(
    (v): v is number => v !== null && v > 0
  );
  const diff = calcDiffPercent(available);
  const status = classifyStatus(diff);

  const parts: string[] = [];
  if (meterKwh !== null && meterKwh > 0) parts.push(`Medidor: ${meterKwh} kWh`);
  if (monitoringKwh !== null && monitoringKwh > 0) parts.push(`Monitoramento: ${monitoringKwh} kWh`);
  if (invoiceKwh !== null && invoiceKwh > 0) parts.push(`Fatura: ${invoiceKwh} kWh`);
  const notes = parts.length >= 2
    ? `Divergência ${diff.toFixed(1)}% entre ${parts.length} fontes`
    : parts.length === 1
      ? "Apenas 1 fonte disponível"
      : "Nenhuma fonte com dados";

  return {
    meter_kwh: meterKwh,
    monitoring_kwh: monitoringKwh,
    invoice_kwh: invoiceKwh,
    selected_source: selectedSource,
    diff_percent: diff,
    status,
    notes,
  };
}

/**
 * Persist reconciliation record (upsert).
 */
export async function upsertReconciliation(
  gdGroupId: string,
  snapshotId: string,
  year: number,
  month: number,
  result: ReconciliationResult
): Promise<void> {
  await (supabase as any)
    .from("gd_generation_reconciliation")
    .upsert(
      {
        gd_group_id: gdGroupId,
        snapshot_id: snapshotId,
        reference_year: year,
        reference_month: month,
        meter_kwh: result.meter_kwh,
        monitoring_kwh: result.monitoring_kwh,
        invoice_kwh: result.invoice_kwh,
        selected_source: result.selected_source,
        diff_percent: result.diff_percent,
        status: result.status,
        notes: result.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gd_group_id,reference_year,reference_month" }
    );
}
