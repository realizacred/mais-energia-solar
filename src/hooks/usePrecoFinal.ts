import { useMemo } from "react";
import { calcPrecoFinal } from "@/components/admin/propostas-nativas/wizard/types";
import type { KitItemRow, ServicoItem, VendaData } from "@/components/admin/propostas-nativas/wizard/types";

/**
 * SSOT hook for final price calculation.
 * Use in ProposalWizard and StepFinancialCenter — never duplicate calcPrecoFinal logic.
 */
export function usePrecoFinal(
  itens: KitItemRow[],
  servicos: ServicoItem[],
  venda: VendaData,
): number {
  return useMemo(
    () => calcPrecoFinal(itens, servicos, venda),
    [itens, servicos, venda],
  );
}
