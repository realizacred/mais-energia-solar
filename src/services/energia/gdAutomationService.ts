/**
 * gdAutomationService — Orchestrates automatic GD recalculation.
 * SRP: Enqueue recalc items, resolve impact, process queue.
 * Phase 2.8: Does NOT rewrite engines — only orchestrates existing modules.
 */
import { supabase } from "@/integrations/supabase/client";
import { calculateGdMonth } from "./gdEnergyEngine";
import { createEnergyAlert } from "./energyAlertService";

// ─── Types ───────────────────────────────────────────────────────

export type RecalcTriggerType =
  | "invoice_import"
  | "meter_sync"
  | "monitoring_sync"
  | "allocation_change"
  | "linkage_change"
  | "manual";

export type RecalcTriggerEntityType =
  | "invoice"
  | "unit"
  | "meter"
  | "plant"
  | "gd_group";

export interface EnqueueRecalcInput {
  tenantId: string;
  gdGroupId: string;
  referenceYear: number;
  referenceMonth: number;
  triggerType: RecalcTriggerType;
  triggerEntityType?: RecalcTriggerEntityType;
  triggerEntityId?: string;
  requestedBy?: string;
}

export interface QueueItem {
  id: string;
  tenant_id: string;
  gd_group_id: string;
  reference_year: number;
  reference_month: number;
  trigger_type: string;
  trigger_entity_type: string | null;
  trigger_entity_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

const MAX_ATTEMPTS = 3;

// ─── Enqueue ─────────────────────────────────────────────────────

/**
 * Add a recalculation request to the queue.
 * Uses ON CONFLICT to avoid duplicates for same group/month when pending/processing.
 */
export async function enqueueGdRecalc(input: EnqueueRecalcInput): Promise<void> {
  const { error } = await (supabase as any)
    .from("gd_recalc_queue")
    .insert({
      tenant_id: input.tenantId,
      gd_group_id: input.gdGroupId,
      reference_year: input.referenceYear,
      reference_month: input.referenceMonth,
      trigger_type: input.triggerType,
      trigger_entity_type: input.triggerEntityType || null,
      trigger_entity_id: input.triggerEntityId || null,
      requested_by: input.requestedBy || null,
      status: "pending",
    });

  // Ignore unique constraint violations (duplicate pending item)
  if (error && !error.message?.includes("duplicate") && !error.code?.includes("23505")) {
    console.error("[gdAutomation] Enqueue error:", error);
  }
}

// ─── Impact Resolution ──────────────────────────────────────────

/**
 * Find GD groups affected by a unit invoice import.
 */
export async function resolveAffectedGroupsFromInvoice(
  unitId: string,
  year: number,
  month: number
): Promise<Array<{ gdGroupId: string; tenantId: string }>> {
  const results: Array<{ gdGroupId: string; tenantId: string }> = [];

  // Check if unit is a generator
  const { data: asGenerator } = await supabase
    .from("gd_groups")
    .select("id, tenant_id")
    .eq("uc_geradora_id", unitId)
    .eq("status", "active");

  if (asGenerator) {
    for (const g of asGenerator) {
      results.push({ gdGroupId: g.id, tenantId: g.tenant_id });
    }
  }

  // Check if unit is a beneficiary
  const { data: asBeneficiary } = await supabase
    .from("gd_group_beneficiaries")
    .select("gd_group_id, tenant_id")
    .eq("uc_beneficiaria_id", unitId)
    .eq("is_active", true);

  if (asBeneficiary) {
    for (const b of asBeneficiary) {
      if (!results.find(r => r.gdGroupId === b.gd_group_id)) {
        results.push({ gdGroupId: b.gd_group_id, tenantId: b.tenant_id });
      }
    }
  }

  return results;
}

/**
 * Find GD groups affected by a meter sync (meter linked to UC geradora).
 */
export async function resolveAffectedGroupsFromMeter(
  unitId: string
): Promise<Array<{ gdGroupId: string; tenantId: string }>> {
  const { data: groups } = await supabase
    .from("gd_groups")
    .select("id, tenant_id")
    .eq("uc_geradora_id", unitId)
    .eq("status", "active");

  return (groups || []).map(g => ({ gdGroupId: g.id, tenantId: g.tenant_id }));
}

/**
 * Find GD groups affected by a monitoring plant sync.
 */
export async function resolveAffectedGroupsFromPlant(
  plantId: string
): Promise<Array<{ gdGroupId: string; tenantId: string }>> {
  // Get units linked to this plant
  const { data: links } = await (supabase as any)
    .from("unit_plant_links")
    .select("unit_id")
    .eq("plant_id", plantId)
    .eq("is_active", true);

  if (!links || links.length === 0) return [];

  const unitIds = links.map((l: any) => l.unit_id);
  const { data: groups } = await supabase
    .from("gd_groups")
    .select("id, tenant_id")
    .in("uc_geradora_id", unitIds)
    .eq("status", "active");

  return (groups || []).map(g => ({ gdGroupId: g.id, tenantId: g.tenant_id }));
}

/**
 * Resolve from allocation change — just the group itself.
 */
export function resolveAffectedGroupsFromAllocationChange(
  gdGroupId: string,
  tenantId: string
): Array<{ gdGroupId: string; tenantId: string }> {
  return [{ gdGroupId, tenantId }];
}

// ─── Queue Processing ───────────────────────────────────────────

/**
 * Process a single queue item: calculate → reconciliate → alerts.
 */
export async function processSingleQueueItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  // 1. Mark as processing
  const { data: item, error: fetchErr } = await (supabase as any)
    .from("gd_recalc_queue")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (fetchErr || !item) {
    return { success: false, error: fetchErr?.message || "Item not found or already processing" };
  }

  try {
    // 2. Run engine (recalculate = true)
    await calculateGdMonth(item.gd_group_id, item.reference_year, item.reference_month, true);

    // 3. Mark completed
    await (supabase as any)
      .from("gd_recalc_queue")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const newAttempts = (item.attempts || 0) + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await (supabase as any)
      .from("gd_recalc_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    // Create alert if permanently failed
    if (newStatus === "failed") {
      try {
        await createEnergyAlert({
          tenant_id: item.tenant_id,
          gd_group_id: item.gd_group_id,
          alert_type: "reconciliation_critical",
          severity: "critical",
          title: "Falha no recálculo automático",
          description: `O recálculo do mês ${item.reference_month}/${item.reference_year} falhou após ${MAX_ATTEMPTS} tentativas: ${errorMsg}`,
          context_json: { queue_item_id: itemId, trigger_type: item.trigger_type },
        });
      } catch {
        // non-blocking
      }
    }

    return { success: false, error: errorMsg };
  }
}

/**
 * Process pending items from the queue.
 */
export async function processPendingRecalcQueue(
  limit = 10
): Promise<{ processed: number; failed: number; errors: string[] }> {
  const { data: items } = await (supabase as any)
    .from("gd_recalc_queue")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!items || items.length === 0) {
    return { processed: 0, failed: 0, errors: [] };
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const result = await processSingleQueueItem(item.id);
    if (result.success) {
      processed++;
    } else {
      failed++;
      if (result.error) errors.push(result.error);
    }
  }

  return { processed, failed, errors };
}
