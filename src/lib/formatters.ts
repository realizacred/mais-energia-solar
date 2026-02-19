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

// ─── Number Formatting (pt-BR) ─────────────────────────────

const numberFull = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format number as Brazilian locale: "1.234,56"
 */
export function formatNumberBR(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return numberFull.format(value);
}

/**
 * Parse a Brazilian-formatted number string to a JS number.
 * Handles: "1.234,56" → 1234.56, "99.999,99" → 99999.99
 */
export function parseBRNumber(value: string): number {
  if (!value || value.trim() === "") return 0;
  let str = value.trim();
  // Remove currency symbols, spaces
  str = str.replace(/[R$\s]/g, "");
  // Brazilian: dot = thousands, comma = decimal
  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Brazilian format: 1.234,56
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // English format or no comma: 1,234.56
    str = str.replace(/,/g, "");
  } else {
    // No separator or ambiguous
    str = str.replace(/,/g, "");
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : roundCurrency(parsed);
}

/**
 * Round a number to 2 decimal places using banker's rounding.
 * Use this for ALL monetary calculations to avoid floating-point drift.
 */
export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
