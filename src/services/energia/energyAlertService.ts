/**
 * energyAlertService — Business logic for generating energy alerts.
 * SSOT for alert classification. §17: Logic in services, not components.
 */
import { supabase } from "@/integrations/supabase/client";

export type EnergyAlertType =
  | "no_generation"
  | "missing_invoice"
  | "allocation_mismatch"
  | "meter_offline"
  | "reconciliation_critical";

interface AlertInput {
  tenant_id: string;
  gd_group_id?: string | null;
  unit_id?: string | null;
  plant_id?: string | null;
  alert_type: EnergyAlertType;
  severity: "info" | "warning" | "critical";
  title: string;
  description?: string;
  context_json?: Record<string, any>;
}

/**
 * Create an energy alert if no duplicate pending alert exists.
 */
export async function createEnergyAlert(input: AlertInput): Promise<void> {
  // Dedupe: check for existing unresolved alert of same type+entity
  const dedupeQuery: Record<string, any> = {
    alert_type: input.alert_type,
  };
  if (input.gd_group_id) dedupeQuery.gd_group_id = input.gd_group_id;
  if (input.unit_id) dedupeQuery.unit_id = input.unit_id;
  if (input.plant_id) dedupeQuery.plant_id = input.plant_id;

  let q = (supabase as any)
    .from("energy_alerts")
    .select("id")
    .is("resolved_at", null)
    .eq("alert_type", input.alert_type);

  if (input.gd_group_id) q = q.eq("gd_group_id", input.gd_group_id);
  if (input.unit_id) q = q.eq("unit_id", input.unit_id);
  if (input.plant_id) q = q.eq("plant_id", input.plant_id);

  const { data: existing } = await q.limit(1);
  if (existing && existing.length > 0) return; // Already has pending alert

  await (supabase as any).from("energy_alerts").insert({
    tenant_id: input.tenant_id,
    gd_group_id: input.gd_group_id || null,
    unit_id: input.unit_id || null,
    plant_id: input.plant_id || null,
    alert_type: input.alert_type,
    severity: input.severity,
    title: input.title,
    description: input.description || null,
    context_json: input.context_json || {},
  });
}

/**
 * Check allocation sum for a GD group and create alert if != 100%.
 */
export async function checkAllocationMismatch(
  tenantId: string,
  gdGroupId: string,
  groupName: string,
  totalPercent: number
): Promise<void> {
  if (Math.abs(totalPercent - 100) < 0.01) return;

  await createEnergyAlert({
    tenant_id: tenantId,
    gd_group_id: gdGroupId,
    alert_type: "allocation_mismatch",
    severity: "warning",
    title: `Rateio do grupo "${groupName}" não soma 100%`,
    description: `O rateio atual soma ${totalPercent.toFixed(1)}%. Ajuste as alocações das beneficiárias.`,
    context_json: { total_percent: totalPercent },
  });
}

/**
 * Alert for reconciliation critical divergence.
 */
export async function checkReconciliationAlert(
  tenantId: string,
  gdGroupId: string,
  groupName: string,
  diffPercent: number
): Promise<void> {
  if (diffPercent <= 15) return;

  await createEnergyAlert({
    tenant_id: tenantId,
    gd_group_id: gdGroupId,
    alert_type: "reconciliation_critical",
    severity: "critical",
    title: `Divergência crítica no grupo "${groupName}"`,
    description: `Divergência de ${diffPercent.toFixed(1)}% entre fontes de geração. Verifique medidor, monitoramento e fatura.`,
    context_json: { diff_percent: diffPercent },
  });
}
