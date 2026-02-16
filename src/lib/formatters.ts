// ─── Canonical Currency Formatters ─────────────────────────────
// Single Source of Truth for monetary formatting across the SaaS.
// ALL components MUST import from here. Do NOT create local formatBRL/formatCurrency.

const currencyFull = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const currencyNoDecimals = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats a number as BRL currency: "R$ 1.234,56"
 * Returns "—" for null/undefined, "R$ 0,00" for 0.
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return currencyFull.format(value);
}

/**
 * Formats a number as BRL without decimals: "R$ 1.235"
 * Returns "—" for null/undefined, "R$ 0" for 0.
 */
export function formatBRLInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return currencyNoDecimals.format(value);
}

/**
 * Compact format for dashboards: "R$ 1,2M", "R$ 350K", "R$ 800"
 * Returns "R$ 0" for null/undefined/0.
 */
export function formatBRLCompact(value: number | null | undefined): string {
  if (!value) return "R$ 0";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}K`;
  return currencyNoDecimals.format(value);
}
