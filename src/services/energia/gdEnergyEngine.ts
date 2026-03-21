/**
 * gdEnergyEngine — SSOT engine for GD monthly energy calculation.
 * SRP: Calculate generation, allocation, compensation, surplus, deficit, and savings.
 * Phase 2.2: Multi-source generation resolver (meter > monitoring > invoice > missing).
 * Phase 2.x: Source reconciliation (meter vs monitoring vs invoice).
 */
import { supabase } from "@/integrations/supabase/client";
import { buildReconciliation, upsertReconciliation } from "./gdReconciliation";

// ─── Types ───────────────────────────────────────────────────────

export type CalculationStatus =
  | "complete"
  | "partial"
  | "missing_generation"
  | "missing_beneficiary_invoice"
  | "inconsistent"
  | "pending";

export type GenerationSourceType = "meter" | "monitoring" | "invoice" | "missing";
export type GenerationConfidence = "high" | "medium" | "low" | "missing";

export interface GenerationSourceResult {
  generation_kwh: number;
  generator_consumption_kwh: number;
  source_type: GenerationSourceType;
  source_id: string | null;
  confidence: GenerationConfidence;
  notes: string | null;
  status: CalculationStatus;
}

export interface GdMonthlySnapshot {
  id: string;
  tenant_id: string;
  gd_group_id: string;
  reference_year: number;
  reference_month: number;
  generation_kwh: number;
  generator_consumption_kwh: number;
  total_allocated_kwh: number;
  total_compensated_kwh: number;
  total_surplus_kwh: number;
  total_deficit_kwh: number;
  calculation_status: CalculationStatus;
  generation_source_type: GenerationSourceType;
  generation_source_id: string | null;
  generation_source_confidence: GenerationConfidence;
  generation_source_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GdMonthlyAllocation {
  id: string;
  tenant_id: string;
  snapshot_id: string;
  gd_group_id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number;
  allocated_kwh: number;
  consumed_kwh: number;
  compensated_kwh: number;
  surplus_kwh: number;
  deficit_kwh: number;
  prior_balance_kwh: number;
  used_from_balance_kwh: number;
  estimated_savings_brl: number | null;
  source_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GdCreditBalance {
  id: string;
  tenant_id: string;
  gd_group_id: string;
  uc_id: string;
  balance_kwh: number;
  last_reference_year: number | null;
  last_reference_month: number | null;
  updated_at: string;
}

interface BeneficiaryData {
  id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number;
  is_active: boolean;
}

// ─── Source Resolution Functions ──────────────────────────────────

/**
 * Priority 1: Get generation from meter readings linked to the UC geradora.
 * Uses meter_readings.energy_export_kwh aggregated for the month.
 */
async function getMeterGenerationForMonth(
  ucGeradoraId: string,
  year: number,
  month: number
): Promise<GenerationSourceResult | null> {
  // Find active meter linked to this UC
  const { data: links } = await (supabase as any)
    .from("unit_meter_links")
    .select("meter_device_id")
    .eq("unit_id", ucGeradoraId)
    .eq("is_active", true);

  if (!links || links.length === 0) return null;

  const meterIds = links.map((l: any) => l.meter_device_id);

  // Get date range for the month
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 1).toISOString();

  // Aggregate energy_export_kwh for the month from meter_readings
  const { data: readings } = await (supabase as any)
    .from("meter_readings")
    .select("energy_export_kwh, energy_import_kwh, meter_device_id")
    .in("meter_device_id", meterIds)
    .gte("measured_at", startDate)
    .lt("measured_at", endDate)
    .order("measured_at", { ascending: false });

  if (!readings || readings.length === 0) return null;

  // For cumulative meters, use max - min of export readings
  // Group by meter and find delta
  const meterGroups = new Map<string, number[]>();
  for (const r of readings) {
    const val = Number(r.energy_export_kwh);
    if (isNaN(val) || val === 0) continue;
    if (!meterGroups.has(r.meter_device_id)) meterGroups.set(r.meter_device_id, []);
    meterGroups.get(r.meter_device_id)!.push(val);
  }

  let totalExport = 0;
  let bestMeterId: string | null = null;
  for (const [meterId, values] of meterGroups) {
    if (values.length < 2) continue;
    const delta = Math.max(...values) - Math.min(...values);
    if (delta > 0) {
      totalExport += delta;
      bestMeterId = meterId;
    }
  }

  if (totalExport <= 0) return null;

  // Also get import for consumption estimate
  const importGroups = new Map<string, number[]>();
  for (const r of readings) {
    const val = Number(r.energy_import_kwh);
    if (isNaN(val) || val === 0) continue;
    if (!importGroups.has(r.meter_device_id)) importGroups.set(r.meter_device_id, []);
    importGroups.get(r.meter_device_id)!.push(val);
  }
  let totalImport = 0;
  for (const values of importGroups.values()) {
    if (values.length >= 2) totalImport += Math.max(...values) - Math.min(...values);
  }

  return {
    generation_kwh: Math.round(totalExport * 100) / 100,
    generator_consumption_kwh: Math.round(totalImport * 100) / 100,
    source_type: "meter",
    source_id: bestMeterId,
    confidence: "high",
    notes: `Medidor: ${readings.length} leituras no mês`,
    status: "complete",
  };
}

/**
 * Priority 2: Get generation from monitoring (monitor_readings_daily) via plant linked to UC.
 */
async function getMonitoringGenerationForMonth(
  ucGeradoraId: string,
  year: number,
  month: number
): Promise<GenerationSourceResult | null> {
  // Find plant linked to this UC
  const { data: plantLinks } = await (supabase as any)
    .from("unit_plant_links")
    .select("plant_id")
    .eq("unit_id", ucGeradoraId)
    .eq("is_active", true);

  if (!plantLinks || plantLinks.length === 0) return null;

  const plantIds = plantLinks.map((l: any) => l.plant_id);

  // Date range
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  // Sum daily energy for the month
  const { data: dailyReadings } = await (supabase as any)
    .from("monitor_readings_daily")
    .select("energy_kwh, plant_id")
    .in("plant_id", plantIds)
    .gte("date", startDate)
    .lte("date", endDate);

  if (!dailyReadings || dailyReadings.length === 0) return null;

  let totalEnergy = 0;
  let bestPlantId: string | null = null;
  for (const r of dailyReadings) {
    const val = Number(r.energy_kwh);
    if (!isNaN(val) && val > 0) {
      totalEnergy += val;
      bestPlantId = r.plant_id;
    }
  }

  if (totalEnergy <= 0) return null;

  const daysWithData = dailyReadings.filter((r: any) => Number(r.energy_kwh) > 0).length;
  const daysInMonth = lastDay;
  const confidence: GenerationConfidence = daysWithData >= daysInMonth * 0.9 ? "high" : daysWithData >= daysInMonth * 0.5 ? "medium" : "low";

  return {
    generation_kwh: Math.round(totalEnergy * 100) / 100,
    generator_consumption_kwh: 0, // monitoring doesn't provide consumption directly
    source_type: "monitoring",
    source_id: bestPlantId,
    confidence,
    notes: `Monitoramento: ${daysWithData}/${daysInMonth} dias com dados`,
    status: "complete",
  };
}

/**
 * Priority 3: Get generation from UC geradora invoice (fallback).
 */
async function getInvoiceGenerationForMonth(
  ucGeradoraId: string,
  year: number,
  month: number
): Promise<GenerationSourceResult | null> {
  const { data: invoice } = await supabase
    .from("unit_invoices")
    .select("id, energy_consumed_kwh, energy_injected_kwh, compensated_kwh")
    .eq("unit_id", ucGeradoraId)
    .eq("reference_year", year)
    .eq("reference_month", month)
    .maybeSingle();

  if (!invoice) return null;

  const gen = Number(invoice.energy_injected_kwh ?? invoice.compensated_kwh ?? 0);
  const cons = Number(invoice.energy_consumed_kwh ?? 0);

  if (gen <= 0 && cons <= 0) return null;

  return {
    generation_kwh: gen,
    generator_consumption_kwh: cons,
    source_type: "invoice",
    source_id: invoice.id,
    confidence: gen > 0 ? "medium" : "low",
    notes: gen > 0 ? "Fatura: energia injetada" : "Fatura: sem geração registrada",
    status: gen > 0 ? "complete" : "partial",
  };
}

// ─── Central Resolver (SSOT) ────────────────────────────────────

/**
 * Resolve the best generation source for a GD group in a given month.
 * Priority: meter > monitoring > invoice > missing.
 */
export async function resolveGenerationSourceForMonth(
  ucGeradoraId: string,
  year: number,
  month: number
): Promise<GenerationSourceResult> {
  // Priority 1: Meter
  const meterSource = await getMeterGenerationForMonth(ucGeradoraId, year, month);
  if (meterSource) return meterSource;

  // Priority 2: Monitoring
  const monitoringSource = await getMonitoringGenerationForMonth(ucGeradoraId, year, month);
  if (monitoringSource) return monitoringSource;

  // Priority 3: Invoice
  const invoiceSource = await getInvoiceGenerationForMonth(ucGeradoraId, year, month);
  if (invoiceSource) return invoiceSource;

  // Priority 4: Missing
  return {
    generation_kwh: 0,
    generator_consumption_kwh: 0,
    source_type: "missing",
    source_id: null,
    confidence: "missing",
    notes: "Nenhuma fonte de geração encontrada",
    status: "missing_generation",
  };
}

// ─── Beneficiary Consumption ────────────────────────────────────

async function getBeneficiaryConsumption(
  ucId: string,
  year: number,
  month: number
): Promise<{ consumed_kwh: number; invoice_id: string | null; total_amount: number | null; missing: boolean }> {
  const { data: invoice } = await supabase
    .from("unit_invoices")
    .select("id, energy_consumed_kwh, total_amount")
    .eq("unit_id", ucId)
    .eq("reference_year", year)
    .eq("reference_month", month)
    .maybeSingle();

  if (!invoice) {
    return { consumed_kwh: 0, invoice_id: null, total_amount: null, missing: true };
  }

  return {
    consumed_kwh: Number(invoice.energy_consumed_kwh ?? 0),
    invoice_id: invoice.id,
    total_amount: invoice.total_amount,
    missing: false,
  };
}

function estimateSavings(
  compensated_kwh: number,
  consumed_kwh: number,
  total_amount: number | null
): number | null {
  if (!total_amount || consumed_kwh <= 0 || compensated_kwh <= 0) return null;
  const tariff = total_amount / consumed_kwh;
  return Math.round(compensated_kwh * tariff * 100) / 100;
}

// ─── Main Engine ─────────────────────────────────────────────────

export async function calculateGdMonth(
  gdGroupId: string,
  year: number,
  month: number,
  recalculate = false
): Promise<GdMonthlySnapshot> {
  // 1. Load group
  const { data: group, error: gErr } = await supabase
    .from("gd_groups")
    .select("id, tenant_id, uc_geradora_id, status")
    .eq("id", gdGroupId)
    .single();
  if (gErr || !group) throw new Error(`Grupo GD não encontrado: ${gdGroupId}`);

  // 2. Check existing snapshot
  if (!recalculate) {
    const { data: existing } = await (supabase as any)
      .from("gd_monthly_snapshots")
      .select("*")
      .eq("gd_group_id", gdGroupId)
      .eq("reference_year", year)
      .eq("reference_month", month)
      .maybeSingle();
    if (existing && existing.calculation_status === "complete") {
      return existing as GdMonthlySnapshot;
    }
  }

  // 3. Resolve generation source (SSOT — meter > monitoring > invoice > missing)
  const genSource = await resolveGenerationSourceForMonth(group.uc_geradora_id, year, month);

  // 4. Get active beneficiaries
  const { data: bens = [] } = await supabase
    .from("gd_group_beneficiaries")
    .select("id, uc_beneficiaria_id, allocation_percent, is_active")
    .eq("gd_group_id", gdGroupId)
    .eq("is_active", true);

  // 5. Calculate allocations
  let totalAllocated = 0;
  let totalCompensated = 0;
  let totalSurplus = 0;
  let totalDeficit = 0;
  let hasMissingInvoice = false;

  const allocations: Array<{
    uc_beneficiaria_id: string;
    allocation_percent: number;
    allocated_kwh: number;
    consumed_kwh: number;
    compensated_kwh: number;
    surplus_kwh: number;
    deficit_kwh: number;
    prior_balance_kwh: number;
    used_from_balance_kwh: number;
    estimated_savings_brl: number | null;
    source_invoice_id: string | null;
  }> = [];

  for (const ben of bens as BeneficiaryData[]) {
    const allocated_kwh = Math.round(genSource.generation_kwh * (ben.allocation_percent / 100) * 100) / 100;
    const benConsumption = await getBeneficiaryConsumption(ben.uc_beneficiaria_id, year, month);

    if (benConsumption.missing) hasMissingInvoice = true;

    // Fetch prior credit balance for this UC in this group
    const { data: priorBalance } = await (supabase as any)
      .from("gd_credit_balances")
      .select("balance_kwh")
      .eq("gd_group_id", gdGroupId)
      .eq("uc_id", ben.uc_beneficiaria_id)
      .maybeSingle();
    const prior_balance_kwh = Math.round(Number(priorBalance?.balance_kwh || 0) * 100) / 100;

    // Smart balance: total_available = allocated + prior balance
    const total_available = allocated_kwh + prior_balance_kwh;
    const compensated_kwh = Math.min(total_available, benConsumption.consumed_kwh);
    const used_from_balance_kwh = Math.min(prior_balance_kwh, Math.max(benConsumption.consumed_kwh - allocated_kwh, 0));
    const new_balance = Math.round(Math.max(total_available - benConsumption.consumed_kwh, 0) * 100) / 100;
    const surplus_kwh = Math.round(Math.max(allocated_kwh - benConsumption.consumed_kwh, 0) * 100) / 100;
    const deficit_kwh = Math.round(Math.max(benConsumption.consumed_kwh - total_available, 0) * 100) / 100;
    const savings = estimateSavings(compensated_kwh, benConsumption.consumed_kwh, benConsumption.total_amount);

    totalAllocated += allocated_kwh;
    totalCompensated += compensated_kwh;
    totalSurplus += surplus_kwh;
    totalDeficit += deficit_kwh;

    allocations.push({
      uc_beneficiaria_id: ben.uc_beneficiaria_id,
      allocation_percent: ben.allocation_percent,
      allocated_kwh,
      consumed_kwh: benConsumption.consumed_kwh,
      compensated_kwh,
      surplus_kwh,
      deficit_kwh,
      prior_balance_kwh,
      used_from_balance_kwh: Math.round(used_from_balance_kwh * 100) / 100,
      estimated_savings_brl: savings,
      source_invoice_id: benConsumption.invoice_id,
      _new_balance: new_balance, // internal, used for credit update
    } as any);
  }

  // 6. Determine status
  let calcStatus: CalculationStatus = genSource.status;
  if (calcStatus === "complete" && hasMissingInvoice) calcStatus = "missing_beneficiary_invoice";

  // 7. Upsert snapshot with source metadata
  const snapshotPayload = {
    gd_group_id: gdGroupId,
    reference_year: year,
    reference_month: month,
    generation_kwh: genSource.generation_kwh,
    generator_consumption_kwh: genSource.generator_consumption_kwh,
    total_allocated_kwh: Math.round(totalAllocated * 100) / 100,
    total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
    total_surplus_kwh: Math.round(totalSurplus * 100) / 100,
    total_deficit_kwh: Math.round(totalDeficit * 100) / 100,
    calculation_status: calcStatus,
    generation_source_type: genSource.source_type,
    generation_source_id: genSource.source_id,
    generation_source_confidence: genSource.confidence,
    generation_source_notes: genSource.notes,
    updated_at: new Date().toISOString(),
  };

  const { data: snapshot, error: snapErr } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .upsert(snapshotPayload, { onConflict: "gd_group_id,reference_year,reference_month" })
    .select("*")
    .single();

  if (snapErr) throw new Error(`Erro ao salvar snapshot: ${snapErr.message}`);

  // 8. Upsert allocations
  for (const alloc of allocations) {
    await (supabase as any)
      .from("gd_monthly_allocations")
      .upsert(
        {
          snapshot_id: snapshot.id,
          gd_group_id: gdGroupId,
          ...alloc,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "snapshot_id,uc_beneficiaria_id" }
      );
  }

  // 9. Update credit balances (idempotent: set new_balance directly)
  for (const alloc of allocations) {
    const newBalance = (alloc as any)._new_balance as number;
    const { data: existing } = await (supabase as any)
      .from("gd_credit_balances")
      .select("id")
      .eq("gd_group_id", gdGroupId)
      .eq("uc_id", alloc.uc_beneficiaria_id)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from("gd_credit_balances")
        .update({
          balance_kwh: newBalance,
          last_reference_year: year,
          last_reference_month: month,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else if (newBalance > 0) {
      await (supabase as any)
        .from("gd_credit_balances")
        .insert({
          gd_group_id: gdGroupId,
          uc_id: alloc.uc_beneficiaria_id,
          balance_kwh: newBalance,
          last_reference_year: year,
          last_reference_month: month,
        });
    }
  }

  return snapshot as GdMonthlySnapshot;
}

export async function calculateAllActiveGdGroups(
  year: number,
  month: number,
  recalculate = false
): Promise<GdMonthlySnapshot[]> {
  const { data: groups = [] } = await supabase
    .from("gd_groups")
    .select("id")
    .eq("status", "active");

  const results: GdMonthlySnapshot[] = [];
  for (const g of groups) {
    try {
      const snap = await calculateGdMonth(g.id, year, month, recalculate);
      results.push(snap);
    } catch (err) {
      console.error(`Erro ao calcular grupo ${g.id}:`, err);
    }
  }
  return results;
}
