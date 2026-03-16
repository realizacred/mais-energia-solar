/**
 * Charts Normalizer — canonical placeholder normalization.
 * Reused across frontend and backend.
 */

/**
 * Normalize a chart placeholder for comparison.
 * Strips brackets and whitespace, lowercases for safety.
 *
 * Examples:
 *   "[grafico_geracao_mensal]" → "grafico_geracao_mensal"
 *   "grafico_geracao_mensal"   → "grafico_geracao_mensal"
 *   " [vc_grafico_de_comparacao] " → "vc_grafico_de_comparacao"
 */
export function normalizeChartPlaceholder(input: string): string {
  if (!input) return "";
  return input.trim().replace(/^\[|\]$/g, "").replace(/\s+/g, "_").toLowerCase();
}
