import { useMemo } from "react";
import type { PaymentItemInput, CompositionSummary } from "@/services/paymentComposition/types";
import { computeSummary, validateComposition } from "@/services/paymentComposition/calculator";

export interface VendaFinanceSnapshot {
  valorVenda: number;
  items: PaymentItemInput[];
  summary: CompositionSummary;
  errors: string[];
  isValid: boolean;
  totalAlocado: number;
  valorRestante: number;
}

/**
 * SSOT Hook for Sale Financial State.
 * Centralizes calculations and validations to be used across Desktop and Mobile views.
 */
export function useVendaFinanceSnapshot(
  valorVenda: number,
  items: PaymentItemInput[]
): VendaFinanceSnapshot {
  const summary = useMemo(() => computeSummary(items, valorVenda), [items, valorVenda]);
  const errors = useMemo(() => validateComposition(items, valorVenda), [items, valorVenda]);

  return {
    valorVenda,
    items,
    summary,
    errors,
    isValid: summary.is_valid && errors.length === 0,
    totalAlocado: summary.total_alocado,
    valorRestante: summary.valor_restante,
  };
}
