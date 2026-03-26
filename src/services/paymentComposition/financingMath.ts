// ═══════════════════════════════════════════════════════
// SSOT — Financing Math (PMT, installment helpers)
// Single Source of Truth for financing calculations
// ═══════════════════════════════════════════════════════

/**
 * Round to 2 decimal places.
 */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * PMT formula — calculates fixed monthly installment for a loan.
 *
 * @param principal  Amount financed (after entry/down payment)
 * @param taxaMensalPercent  Monthly interest rate as percentage (e.g. 1.29 = 1.29%)
 * @param numParcelas  Number of installments
 * @returns Monthly installment value
 */
export function calcularPrestacao(
  principal: number,
  taxaMensalPercent: number,
  numParcelas: number
): number {
  if (numParcelas <= 0 || principal <= 0) return 0;
  if (taxaMensalPercent <= 0) return round2(principal / numParcelas);

  const r = taxaMensalPercent / 100;
  const fator = Math.pow(1 + r, numParcelas);
  return round2(principal * (r * fator) / (fator - 1));
}

/**
 * Calculates total paid and total interest from a PMT loan.
 */
export function calcularTotalFinanciamento(
  principal: number,
  taxaMensalPercent: number,
  numParcelas: number
): { valorParcela: number; totalPago: number; totalJuros: number } {
  const valorParcela = calcularPrestacao(principal, taxaMensalPercent, numParcelas);
  const totalPago = round2(valorParcela * numParcelas);
  const totalJuros = round2(totalPago - principal);
  return { valorParcela, totalPago, totalJuros };
}

/**
 * Formats taxa_mensal for display — always as percentage.
 * Handles both formats: decimal (0.0129) and percent (1.29).
 *
 * Rule: if value < 0.5, assume it's decimal and multiply by 100.
 * Otherwise, display as-is with 2 decimal places.
 */
export function formatTaxaMensal(taxa: number | null | undefined): string {
  const val = Number(taxa) || 0;
  if (val <= 0) return "0,00%";
  // Values below 0.5 are likely decimal (e.g. 0.0129), convert to percent
  const percent = val < 0.5 ? val * 100 : val;
  return `${percent.toFixed(2).replace(".", ",")}%`;
}
