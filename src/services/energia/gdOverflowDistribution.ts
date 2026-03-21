/**
 * gdOverflowDistribution — Credit overflow redistribution between beneficiaries.
 * Phase 2.4: Redistributes surplus from UCs with excess to UCs with deficit.
 * SRP: Only handles overflow logic, does NOT touch the base calculation.
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────

interface AllocationWithOverflow {
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
  overflow_received_kwh: number;
  overflow_ceded_kwh: number;
  _new_balance: number;
}

interface BeneficiaryOverflowConfig {
  uc_beneficiaria_id: string;
  priority_order: number | null;
  allow_overflow_in: boolean;
  allow_overflow_out: boolean;
}

export interface OverflowTransfer {
  from_uc_id: string;
  to_uc_id: string;
  overflow_kwh: number;
}

export interface OverflowResult {
  allocations: AllocationWithOverflow[];
  transfers: OverflowTransfer[];
  total_overflow_kwh: number;
}

// ─── Main Function ───────────────────────────────────────────────

/**
 * Apply overflow distribution to already-calculated allocations.
 * Called AFTER the base engine calculates allocations.
 * Does NOT mutate the database — returns adjusted allocations and transfers.
 */
export function applyOverflowDistribution(
  allocations: AllocationWithOverflow[],
  beneficiaryConfigs: BeneficiaryOverflowConfig[]
): OverflowResult {
  const configMap = new Map(beneficiaryConfigs.map(c => [c.uc_beneficiaria_id, c]));
  const transfers: OverflowTransfer[] = [];

  // 1. Build working copies
  const working = allocations.map(a => ({
    ...a,
    overflow_received_kwh: 0,
    overflow_ceded_kwh: 0,
  }));

  // 2. Identify donors (surplus > 0 and allow_overflow_out)
  const donors = working
    .filter(a => {
      const cfg = configMap.get(a.uc_beneficiaria_id);
      return a.surplus_kwh > 0 && (cfg?.allow_overflow_out !== false);
    })
    .sort((a, b) => b.surplus_kwh - a.surplus_kwh); // biggest surplus first

  // 3. Identify receivers (deficit > 0 and allow_overflow_in)
  const receivers = working
    .filter(a => {
      const cfg = configMap.get(a.uc_beneficiaria_id);
      return a.deficit_kwh > 0 && (cfg?.allow_overflow_in !== false);
    })
    .sort((a, b) => {
      const cfgA = configMap.get(a.uc_beneficiaria_id);
      const cfgB = configMap.get(b.uc_beneficiaria_id);
      const prioA = cfgA?.priority_order ?? 999;
      const prioB = cfgB?.priority_order ?? 999;
      if (prioA !== prioB) return prioA - prioB; // lower priority_order = higher priority
      return b.deficit_kwh - a.deficit_kwh; // bigger deficit first as fallback
    });

  if (donors.length === 0 || receivers.length === 0) {
    return { allocations: working, transfers, total_overflow_kwh: 0 };
  }

  // 4. Redistribute
  let totalOverflow = 0;

  for (const receiver of receivers) {
    let remainingDeficit = receiver.deficit_kwh;
    if (remainingDeficit <= 0) continue;

    for (const donor of donors) {
      if (remainingDeficit <= 0) break;
      if (donor.surplus_kwh <= 0) continue;

      const transfer = Math.round(Math.min(donor.surplus_kwh, remainingDeficit) * 100) / 100;
      if (transfer <= 0) continue;

      // Apply transfer
      donor.surplus_kwh = Math.round((donor.surplus_kwh - transfer) * 100) / 100;
      donor.overflow_ceded_kwh = Math.round((donor.overflow_ceded_kwh + transfer) * 100) / 100;

      receiver.deficit_kwh = Math.round((remainingDeficit - transfer) * 100) / 100;
      remainingDeficit = receiver.deficit_kwh;
      receiver.compensated_kwh = Math.round((receiver.compensated_kwh + transfer) * 100) / 100;
      receiver.overflow_received_kwh = Math.round((receiver.overflow_received_kwh + transfer) * 100) / 100;

      // Ensure compensated never exceeds consumed
      if (receiver.compensated_kwh > receiver.consumed_kwh) {
        const excess = Math.round((receiver.compensated_kwh - receiver.consumed_kwh) * 100) / 100;
        receiver.compensated_kwh = receiver.consumed_kwh;
        receiver.overflow_received_kwh = Math.round((receiver.overflow_received_kwh - excess) * 100) / 100;
        donor.surplus_kwh = Math.round((donor.surplus_kwh + excess) * 100) / 100;
        donor.overflow_ceded_kwh = Math.round((donor.overflow_ceded_kwh - excess) * 100) / 100;
      }

      const actualTransfer = Math.round((transfer - Math.max(0, receiver.compensated_kwh - receiver.consumed_kwh)) * 100) / 100;
      if (actualTransfer > 0) {
        transfers.push({
          from_uc_id: donor.uc_beneficiaria_id,
          to_uc_id: receiver.uc_beneficiaria_id,
          overflow_kwh: transfer,
        });
        totalOverflow += transfer;
      }
    }
  }

  return {
    allocations: working,
    transfers,
    total_overflow_kwh: Math.round(totalOverflow * 100) / 100,
  };
}

// ─── Persistence ─────────────────────────────────────────────────

/**
 * Persist overflow transfers to gd_monthly_overflows table.
 */
export async function persistOverflowTransfers(
  snapshotId: string,
  gdGroupId: string,
  transfers: OverflowTransfer[]
): Promise<void> {
  if (transfers.length === 0) return;

  // Delete existing overflows for this snapshot (idempotent)
  await (supabase as any)
    .from("gd_monthly_overflows")
    .delete()
    .eq("snapshot_id", snapshotId);

  // Insert new transfers
  const rows = transfers.map(t => ({
    snapshot_id: snapshotId,
    gd_group_id: gdGroupId,
    from_uc_id: t.from_uc_id,
    to_uc_id: t.to_uc_id,
    overflow_kwh: t.overflow_kwh,
  }));

  await (supabase as any)
    .from("gd_monthly_overflows")
    .insert(rows);
}
