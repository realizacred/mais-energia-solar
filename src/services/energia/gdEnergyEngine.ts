/**
 * gdEnergyEngine — SSOT engine for GD monthly energy calculation.
 * SRP: Calculate generation, allocation, compensation, surplus, deficit, and savings.
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────

export type CalculationStatus =
  | "complete"
  | "partial"
  | "missing_generation"
  | "missing_beneficiary_invoice"
  | "inconsistent"
  | "pending";

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

interface GroupData {
  id: string;
  tenant_id: string;
  uc_geradora_id: string;
  status: string;
}

interface BeneficiaryData {
  id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number;
  is_active: boolean;
}

interface InvoiceData {
  id: string;
  unit_id: string;
  energy_consumed_kwh: number | null;
  energy_injected_kwh: number | null;
  compensated_kwh: number | null;
  total_amount: number | null;
}

// ─── Source Resolution ───────────────────────────────────────────

/**
 * Get generation for a UC geradora in a given month.
 * Priority: 1) invoice energy_injected_kwh, 2) invoice compensated_kwh as proxy, 3) 0
 */
async function getGenerationSource(
  ucGeradoraId: string,
  year: number,
  month: number
): Promise<{ generation_kwh: number; consumption_kwh: number; status: CalculationStatus; invoice_id: string | null }> {
  const { data: invoice } = await supabase
    .from("unit_invoices")
    .select("id, energy_consumed_kwh, energy_injected_kwh, compensated_kwh")
    .eq("unit_id", ucGeradoraId)
    .eq("reference_year", year)
    .eq("reference_month", month)
    .maybeSingle();

  if (!invoice) {
    return { generation_kwh: 0, consumption_kwh: 0, status: "missing_generation", invoice_id: null };
  }

  // Priority: energy_injected > compensated as proxy
  const gen = Number(invoice.energy_injected_kwh ?? invoice.compensated_kwh ?? 0);
  const cons = Number(invoice.energy_consumed_kwh ?? 0);

  return {
    generation_kwh: gen,
    consumption_kwh: cons,
    status: gen > 0 ? "complete" : "partial",
    invoice_id: invoice.id,
  };
}

/**
 * Get consumption for a beneficiary UC in a given month.
 */
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

/**
 * Estimate savings based on compensated kWh and invoice tariff.
 * tariff_per_kwh = total_amount / energy_consumed_kwh (approximate)
 */
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

/**
 * Calculate GD month for a single group.
 * Upserts snapshot and allocations. Returns the snapshot.
 */
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
    const { data: existing } = await supabase
      .from("gd_monthly_snapshots" as any)
      .select("*")
      .eq("gd_group_id", gdGroupId)
      .eq("reference_year", year)
      .eq("reference_month", month)
      .maybeSingle();
    if (existing && (existing as any).calculation_status === "complete") {
      return existing as unknown as GdMonthlySnapshot;
    }
  }

  // 3. Get generation from UC geradora
  const genSource = await getGenerationSource(group.uc_geradora_id, year, month);

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
    estimated_savings_brl: number | null;
    source_invoice_id: string | null;
  }> = [];

  for (const ben of bens as BeneficiaryData[]) {
    const allocated_kwh = Math.round(genSource.generation_kwh * (ben.allocation_percent / 100) * 100) / 100;
    const benConsumption = await getBeneficiaryConsumption(ben.uc_beneficiaria_id, year, month);

    if (benConsumption.missing) hasMissingInvoice = true;

    const compensated_kwh = Math.min(allocated_kwh, benConsumption.consumed_kwh);
    const surplus_kwh = Math.max(allocated_kwh - benConsumption.consumed_kwh, 0);
    const deficit_kwh = Math.max(benConsumption.consumed_kwh - allocated_kwh, 0);
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
      estimated_savings_brl: savings,
      source_invoice_id: benConsumption.invoice_id,
    });
  }

  // 6. Determine status
  let calcStatus: CalculationStatus = "complete";
  if (genSource.status === "missing_generation") calcStatus = "missing_generation";
  else if (hasMissingInvoice) calcStatus = "missing_beneficiary_invoice";
  else if (genSource.status === "partial") calcStatus = "partial";

  // 7. Upsert snapshot
  const snapshotPayload = {
    gd_group_id: gdGroupId,
    reference_year: year,
    reference_month: month,
    generation_kwh: genSource.generation_kwh,
    generator_consumption_kwh: genSource.consumption_kwh,
    total_allocated_kwh: Math.round(totalAllocated * 100) / 100,
    total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
    total_surplus_kwh: Math.round(totalSurplus * 100) / 100,
    total_deficit_kwh: Math.round(totalDeficit * 100) / 100,
    calculation_status: calcStatus,
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

  // 9. Update credit balances for surplus
  for (const alloc of allocations) {
    if (alloc.surplus_kwh > 0) {
      const { data: existing } = await (supabase as any)
        .from("gd_credit_balances")
        .select("id, balance_kwh")
        .eq("gd_group_id", gdGroupId)
        .eq("uc_id", alloc.uc_beneficiaria_id)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("gd_credit_balances")
          .update({
            balance_kwh: Number(existing.balance_kwh) + alloc.surplus_kwh,
            last_reference_year: year,
            last_reference_month: month,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await (supabase as any)
          .from("gd_credit_balances")
          .insert({
            gd_group_id: gdGroupId,
            uc_id: alloc.uc_beneficiaria_id,
            balance_kwh: alloc.surplus_kwh,
            last_reference_year: year,
            last_reference_month: month,
          });
      }
    }
  }

  return snapshot as unknown as GdMonthlySnapshot;
}

/**
 * Calculate all active GD groups for a given month.
 */
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
