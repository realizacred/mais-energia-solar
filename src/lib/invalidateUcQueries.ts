/**
 * Centralized UC query invalidation helper.
 * Use this whenever UC-related data changes (invoices, credits, GD, etc.)
 * to ensure all screens reflect the latest state immediately.
 */
import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidates all UC-related queries for a specific unit.
 * If no unitId is provided, invalidates globally (all units).
 */
export function invalidateUcQueries(qc: QueryClient, unitId?: string) {
  // Invoice & overview queries
  if (unitId) {
    qc.invalidateQueries({ queryKey: ["unit_invoices", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_invoices", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_credit_sum", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_timeline", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_overview_meter_status"] });
    qc.invalidateQueries({ queryKey: ["uc_proxima_leitura", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_energia_resumo", unitId] });
    qc.invalidateQueries({ queryKey: ["uc_detail", unitId] });
    qc.invalidateQueries({ queryKey: ["unit_comparativo", unitId] });
  } else {
    // Global invalidation — all units
    qc.invalidateQueries({ queryKey: ["unit_invoices"] });
    qc.invalidateQueries({ queryKey: ["uc_overview_invoices"] });
    qc.invalidateQueries({ queryKey: ["uc_overview_credit_sum"] });
    qc.invalidateQueries({ queryKey: ["uc_overview_timeline"] });
    qc.invalidateQueries({ queryKey: ["uc_overview_meter_status"] });
    qc.invalidateQueries({ queryKey: ["uc_proxima_leitura"] });
    qc.invalidateQueries({ queryKey: ["uc_energia_resumo"] });
    qc.invalidateQueries({ queryKey: ["uc_detail"] });
    qc.invalidateQueries({ queryKey: ["unit_comparativo"] });
  }

  // GD / Energy queries (always global)
  qc.invalidateQueries({ queryKey: ["gd_monthly_snapshot"] });
  qc.invalidateQueries({ queryKey: ["gd_monthly_allocations"] });
  qc.invalidateQueries({ queryKey: ["gd_credit_balances"] });
  qc.invalidateQueries({ queryKey: ["gd_monthly_overflows"] });
  qc.invalidateQueries({ queryKey: ["gd_reconciliation"] });
  qc.invalidateQueries({ queryKey: ["cliente_energia_resumo"] });

  // Invoices list (global)
  qc.invalidateQueries({ queryKey: ["invoices-list"] });
  qc.invalidateQueries({ queryKey: ["central_invoices"] });
  qc.invalidateQueries({ queryKey: ["invoice_kpis"] });
  qc.invalidateQueries({ queryKey: ["invoice_review_items"] });
}
