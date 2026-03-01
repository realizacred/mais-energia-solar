/**
 * ══════════════════════════════════════════════════════════════
 * CANONICAL FORMATTERS — SINGLE SOURCE OF TRUTH
 * ══════════════════════════════════════════════════════════════
 * ALL formatting logic in the system MUST come from this file.
 * Do NOT create local format functions in components.
 *
 * Re-exports existing SSOT modules + adds missing formatters.
 */

// ─── Re-exports from existing SSOT files ─────────────────────
export {
  formatBRL,
  formatBRLInteger,
  formatBRLCompact,
  formatNumberBR,
  parseBRNumber,
  roundCurrency,
} from "../formatters";

export {
  formatCpfCnpj,
  onlyDigits,
  isValidCpf,
  isValidCnpj,
  isValidCpfCnpj,
  CPF_CNPJ_MAX_LENGTH,
} from "../cpfCnpjUtils";

export {
  formatPhone as formatPhoneMasked,
  formatCEP,
  formatName,
  normalizeEmail,
  validateEmail,
} from "../validations";

// ─── DOCUMENT FORMATTERS ─────────────────────────────────────

/** Format CPF: 000.000.000-00 */
export function formatCPF(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return value;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Format CNPJ: 00.000.000/0000-00 */
export function formatCNPJ(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return value;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/** Auto-detect CPF or CNPJ and format accordingly */
export function formatDocument(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.replace(/\D/g, "");
  if (d.length <= 11) return formatCPF(d);
  return formatCNPJ(d);
}

// ─── PHONE FORMATTERS ────────────────────────────────────────

/**
 * Format Brazilian phone: (DD) 9XXXX-XXXX or (DD) XXXX-XXXX
 * Also handles +55 prefix (E.164).
 */
export function formatPhoneBR(value: string | null | undefined): string {
  if (!value) return "—";
  let d = value.replace(/\D/g, "");
  // Strip country code 55
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return value;
}

/**
 * Format phone for WhatsApp link: +5511999999999
 */
export function formatPhoneE164(value: string | null | undefined): string {
  if (!value) return "";
  const d = value.replace(/\D/g, "");
  if (d.startsWith("55")) return `+${d}`;
  if (d.length >= 10) return `+55${d}`;
  return d;
}

// ─── DATE FORMATTERS ─────────────────────────────────────────

/**
 * Format date as dd/MM/yyyy
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Format date and time as dd/MM/yyyy HH:mm
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/**
 * Format relative time: "há 2h", "há 3 dias", "agora"
 */
export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay < 7) return `há ${diffDay}d`;
  if (diffDay < 30) return `há ${Math.floor(diffDay / 7)}sem`;
  if (diffDay < 365) return `há ${Math.floor(diffDay / 30)}m`;
  return `há ${Math.floor(diffDay / 365)}a`;
}

/**
 * Format date range: "05/05/2024 → 21/05/2024"
 */
export function formatDateRange(start: string | Date | null, end: string | Date | null): string {
  return `${formatDate(start)} → ${formatDate(end)}`;
}

// ─── PERCENTAGE FORMATTERS ───────────────────────────────────

/**
 * Format percentage: "12,34%"
 */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

// ─── ENERGY / SOLAR FORMATTERS ───────────────────────────────

/**
 * Format kWh: "1.234,56 kWh"
 */
export function formatKwh(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kWh`;
}

/**
 * Format kWp: "12,34 kWp"
 */
export function formatKwp(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kWp`;
}

/**
 * Format power kW: "5,67 kW"
 */
export function formatPowerKw(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} kW`;
}

/**
 * Auto-scale energy: kWh → MWh → GWh
 */
export function formatEnergyAutoScale(valueKwh: number | null | undefined): string {
  if (valueKwh === null || valueKwh === undefined) return "—";
  if (Math.abs(valueKwh) >= 1_000_000) {
    return `${(valueKwh / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GWh`;
  }
  if (Math.abs(valueKwh) >= 1_000) {
    return `${(valueKwh / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MWh`;
  }
  return formatKwh(valueKwh);
}

/**
 * Format CO₂ avoided: "123,4 kg" or "1,2 t"
 */
export function formatCO2(valueKg: number | null | undefined): string {
  if (valueKg === null || valueKg === undefined) return "—";
  if (Math.abs(valueKg) >= 1_000) {
    return `${(valueKg / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t CO₂`;
  }
  return `${valueKg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg CO₂`;
}

// ─── NUMBER FORMATTERS ───────────────────────────────────────

/**
 * Format number with custom decimals in pt-BR: "1.234,56"
 */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format integer: "1.234"
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Math.round(value).toLocaleString("pt-BR");
}

// ─── TEXT FORMATTERS ─────────────────────────────────────────

/**
 * Sanitize text: trim + collapse multiple spaces
 */
export function sanitizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().replace(/\s{2,}/g, " ");
}

/**
 * Slugify: lowercase + hyphens + no accents
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Format UF: always 2 uppercase letters
 */
export function formatUF(value: string | null | undefined): string {
  if (!value) return "—";
  return value.trim().toUpperCase().slice(0, 2);
}

// ─── INSTALLMENT FORMATTER ───────────────────────────────────

/**
 * Format installments: "12x de R$ 1.234,56"
 */
export function formatInstallments(parcelas: number, valorParcela: number): string {
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorParcela);
  return `${parcelas}x de ${formatted}`;
}

// ─── TARIFF FORMATTER (solar-specific, 5 decimals) ───────────

/**
 * Format tariff value: "R$ 0,12345" (5 decimal places for energy tariffs)
 */
export function formatTariff(value: number | null | undefined, decimals = 5): string {
  if (value === null || value === undefined) return "—";
  return `R$${value.toFixed(decimals).replace(".", ",")}`;
}

/**
 * Format kWh value inline (no unit suffix): "1.234"
 */
export function formatKwhValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return Math.round(value).toLocaleString("pt-BR");
}
