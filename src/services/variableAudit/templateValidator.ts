/**
 * Template Variable Validator
 * 
 * Pre-generation validator that classifies every placeholder in a template
 * against the catalog, known keys, snapshot data and resolver coverage.
 * 
 * Classification:
 *   OK       — resolved by explicit resolver or snapshot with real value
 *   ALIAS    — resolved via legacy alias mapping (backward compat)
 *   FALLBACK — resolved via derivation/passthrough, not explicit resolver
 *   WARNING  — resolved but via proportional derivation (approximate value)
 *   ERROR    — in catalog but no resolver and no snapshot value
 *   ORPHAN   — not in catalog at all
 */

import {
  VARIABLES_CATALOG,
  type CatalogVariable,
} from "@/lib/variablesCatalog";
import {
  FRONTEND_RESOLVER_KEYS,
  BACKEND_FLATTEN_KEYS,
} from "./knownKeys";
import { isLegacyVariable } from "./statusClassifier";

// ── Types ──────────────────────────────────────────────────────

export type ValidationStatus =
  | "OK"
  | "ALIAS"
  | "FALLBACK"
  | "WARNING"
  | "ERROR"
  | "ORPHAN";

export interface ValidatedVariable {
  /** Original placeholder as found in template (e.g. "[valor_total]" or "{{financeiro.valor_total}}") */
  placeholder: string;
  /** Normalized flat key (e.g. "valor_total") */
  flatKey: string;
  /** Dotted canonical key if found (e.g. "financeiro.valor_total") */
  canonicalKey: string | null;
  /** Classification status */
  status: ValidationStatus;
  /** Human-readable reason */
  reason: string;
  /** Resolved value from snapshot (if available) */
  resolvedValue?: string;
  /** Whether it's optional (not blocking generation) */
  optional: boolean;
  /** Catalog variable reference (if found) */
  catalogEntry?: CatalogVariable;
}

export interface ValidationReport {
  /** Total placeholders found in template */
  totalPlaceholders: number;
  /** Breakdown by status */
  ok: number;
  alias: number;
  fallback: number;
  warning: number;
  error: number;
  orphan: number;
  /** Coverage percentage (OK + ALIAS + FALLBACK + WARNING) / total */
  coveragePct: number;
  /** List of all validated variables */
  variables: ValidatedVariable[];
  /** Only blocking errors (ERROR status, non-optional) */
  blockingErrors: ValidatedVariable[];
  /** Timestamp */
  validatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────

/** Build lookup maps from catalog (computed once) */
function buildCatalogMaps() {
  const byCanonical = new Map<string, CatalogVariable>();
  const byLegacy = new Map<string, CatalogVariable>();

  for (const v of VARIABLES_CATALOG) {
    const dotted = v.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
    byCanonical.set(dotted, v);

    const flat = v.legacyKey.replace(/^\[/, "").replace(/\]$/, "");
    byLegacy.set(flat, v);
  }
  return { byCanonical, byLegacy };
}

const PASSTHROUGH_GROUPS = new Set(["series", "tabelas", "premissas", "customizada"]);

const MONTHS = new Set(["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]);

/** Groups where UC-indexed variants are proportional derivations */
const PROPORTIONAL_UC_GROUPS = new Set(["financeiro"]);

/**
 * Extract all placeholders from a template string.
 * Supports both {{grupo.campo}} (Mustache) and [campo] (legacy) syntax.
 */
export function extractPlaceholders(templateContent: string): string[] {
  const placeholders = new Set<string>();

  // Mustache: {{grupo.campo}}
  const mustacheRegex = /\{\{([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = mustacheRegex.exec(templateContent)) !== null) {
    placeholders.add(match[0]);
  }

  // Legacy: [campo] — exclude common non-variable patterns
  const legacyRegex = /\[([a-zA-Z][a-zA-Z0-9_]+)\]/g;
  while ((match = legacyRegex.exec(templateContent)) !== null) {
    placeholders.add(match[0]);
  }

  return Array.from(placeholders);
}

/**
 * Normalize a placeholder to a flat key.
 */
function toFlatKey(placeholder: string): string {
  // Mustache: {{grupo.campo}} → grupo_campo (flatten with underscore)
  if (placeholder.startsWith("{{") && placeholder.endsWith("}}")) {
    return placeholder.slice(2, -2).replace(/\./g, "_");
  }
  // Legacy: [campo] → campo
  if (placeholder.startsWith("[") && placeholder.endsWith("]")) {
    return placeholder.slice(1, -1);
  }
  return placeholder;
}

/**
 * Normalize a placeholder to a dotted key.
 */
function toDottedKey(placeholder: string): string | null {
  if (placeholder.startsWith("{{") && placeholder.endsWith("}}")) {
    return placeholder.slice(2, -2);
  }
  return null;
}

/**
 * Check if a key matches a monthly pattern (_jan, _fev, etc.)
 */
function isMonthlyKey(key: string): boolean {
  const parts = key.split("_");
  return parts.length > 1 && MONTHS.has(parts[parts.length - 1]);
}

/**
 * Check if a key is an annual series (_0 to _25)
 */
function isAnnualKey(key: string): boolean {
  const match = key.match(/_(\d+)$/);
  if (!match) return false;
  const num = parseInt(match[1]);
  return num >= 0 && num <= 25 && !/_uc\d+$/.test(key);
}

/**
 * Check if a key is UC-indexed (_uc1, _uc2, etc.)
 */
function isUCIndexed(key: string): boolean {
  return /_uc\d+$/.test(key);
}

/**
 * Check if a key is equipment-indexed (inversor_*_1, bateria_*_1, etc.)
 */
function isEquipmentIndexed(key: string): boolean {
  return /_\d+$/.test(key) && (
    key.includes("inversor_") || key.includes("bateria_") ||
    key.includes("kit_comp_") || key.includes("f_nome_") ||
    key.includes("f_parcela_") || key.includes("f_taxa_") ||
    key.includes("f_prazo_") || key.includes("f_entrada_") ||
    key.includes("f_valor_")
  );
}

// ── Main Validator ─────────────────────────────────────────────

/**
 * Validate all placeholders against catalog, resolvers, and snapshot.
 * 
 * @param placeholders - Array of raw placeholder strings from template
 * @param snapshot - Current proposal snapshot (flat key → value)
 * @returns ValidationReport with full classification
 */
export function validateTemplateVariables(
  placeholders: string[],
  snapshot: Record<string, unknown> = {}
): ValidationReport {
  const { byCanonical, byLegacy } = buildCatalogMaps();
  const variables: ValidatedVariable[] = [];

  for (const ph of placeholders) {
    const flatKey = toFlatKey(ph);
    const dottedKey = toDottedKey(ph);

    // Find catalog entry
    const catalogEntry = dottedKey
      ? byCanonical.get(dottedKey) || byLegacy.get(flatKey)
      : byLegacy.get(flatKey);

    const snapshotValue = snapshot[flatKey] ?? snapshot[dottedKey ?? ""];
    const hasSnapshotValue = snapshotValue !== undefined && snapshotValue !== null && snapshotValue !== "";

    const result = classifyPlaceholder({
      flatKey,
      dottedKey,
      catalogEntry,
      hasSnapshotValue,
      snapshotValue,
    });

    variables.push({
      placeholder: ph,
      flatKey,
      canonicalKey: dottedKey || (catalogEntry ? catalogEntry.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "") : null),
      status: result.status,
      reason: result.reason,
      resolvedValue: hasSnapshotValue ? String(snapshotValue) : undefined,
      optional: result.optional,
      catalogEntry,
    });
  }

  const ok = variables.filter(v => v.status === "OK").length;
  const alias = variables.filter(v => v.status === "ALIAS").length;
  const fallback = variables.filter(v => v.status === "FALLBACK").length;
  const warning = variables.filter(v => v.status === "WARNING").length;
  const error = variables.filter(v => v.status === "ERROR").length;
  const orphan = variables.filter(v => v.status === "ORPHAN").length;
  const total = variables.length;

  return {
    totalPlaceholders: total,
    ok,
    alias,
    fallback,
    warning,
    error,
    orphan,
    coveragePct: total > 0 ? Math.round(((ok + alias + fallback + warning) / total) * 100) : 100,
    variables,
    blockingErrors: variables.filter(v => v.status === "ERROR" && !v.optional),
    validatedAt: new Date().toISOString(),
  };
}

// ── Classification Logic ───────────────────────────────────────

interface ClassifyInput {
  flatKey: string;
  dottedKey: string | null;
  catalogEntry: CatalogVariable | undefined;
  hasSnapshotValue: boolean;
  snapshotValue: unknown;
}

function classifyPlaceholder(input: ClassifyInput): {
  status: ValidationStatus;
  reason: string;
  optional: boolean;
} {
  const { flatKey, dottedKey, catalogEntry, hasSnapshotValue } = input;

  // ── 1. ORPHAN: not in catalog at all ──
  if (!catalogEntry) {
    // Check if it's a known pattern (monthly, annual, UC, equipment) even without catalog entry
    if (isMonthlyKey(flatKey)) {
      return { status: "FALLBACK", reason: "Série mensal sem entrada no catálogo (padrão iterativo)", optional: true };
    }
    if (isAnnualKey(flatKey)) {
      return { status: "FALLBACK", reason: "Série anual sem entrada no catálogo (padrão iterativo)", optional: true };
    }
    if (isUCIndexed(flatKey)) {
      return { status: "FALLBACK", reason: "Variante UC-indexada sem entrada no catálogo", optional: true };
    }
    if (isEquipmentIndexed(flatKey)) {
      return { status: "FALLBACK", reason: "Equipamento indexado sem entrada no catálogo", optional: true };
    }
    // Check if it's in backend flatten keys (known but not cataloged)
    if (BACKEND_FLATTEN_KEYS.has(flatKey)) {
      return { status: "FALLBACK", reason: "Chave conhecida no backend (não catalogada)", optional: true };
    }
    // True orphan
    if (hasSnapshotValue) {
      return { status: "WARNING", reason: "Placeholder com valor no snapshot mas sem entrada no catálogo", optional: true };
    }
    return { status: "ORPHAN", reason: "Placeholder não encontrado no catálogo nem em resolvers conhecidos", optional: false };
  }

  // ── 2. NOT_IMPLEMENTED in catalog ──
  if (catalogEntry.notImplemented) {
    return { status: "ERROR", reason: "Variável marcada como não implementada no catálogo", optional: true };
  }

  const isLegacy = isLegacyVariable(catalogEntry);
  const canonical = dottedKey || catalogEntry.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const group = canonical.split(".")[0];

  // ── 3. PASSTHROUGH groups (always resolved via snapshot deepGet) ──
  if (PASSTHROUGH_GROUPS.has(group)) {
    if (isLegacy) {
      return { status: "ALIAS", reason: `Alias legado em grupo passthrough (${group})`, optional: true };
    }
    if (hasSnapshotValue) {
      return { status: "OK", reason: `Resolvido via passthrough do snapshot (${group})`, optional: false };
    }
    return { status: "FALLBACK", reason: `Grupo ${group} resolvido via passthrough — valor depende do snapshot`, optional: true };
  }

  // ── 4. Pattern-based keys ──
  if (isMonthlyKey(flatKey)) {
    return { status: "OK", reason: "Série mensal resolvida via padrão iterativo", optional: false };
  }
  if (isAnnualKey(flatKey)) {
    return { status: "OK", reason: "Série anual resolvida via padrão iterativo", optional: false };
  }
  if (isEquipmentIndexed(flatKey)) {
    return { status: "OK", reason: "Equipamento indexado resolvido via loop", optional: false };
  }

  // ── 5. UC-indexed — proportional derivation ──
  if (isUCIndexed(flatKey)) {
    if (PROPORTIONAL_UC_GROUPS.has(group)) {
      return { status: "WARNING", reason: "Derivação proporcional por UC (payback/vpl/tir são aproximações)", optional: false };
    }
    return { status: "OK", reason: "Variante UC-indexada resolvida via resolver dedicado", optional: false };
  }

  // ── 6. Legacy alias ──
  if (isLegacy) {
    const inFE = FRONTEND_RESOLVER_KEYS.has(canonical);
    const inBE = BACKEND_FLATTEN_KEYS.has(flatKey);
    if (inFE || inBE || hasSnapshotValue) {
      return { status: "ALIAS", reason: "Alias legado com cobertura em resolver ou snapshot", optional: true };
    }
    return { status: "ALIAS", reason: "Alias legado sem valor atual — será resolvido como vazio", optional: true };
  }

  // ── 7. Explicit resolver coverage ──
  const inFrontend = FRONTEND_RESOLVER_KEYS.has(canonical);
  const inBackend = BACKEND_FLATTEN_KEYS.has(flatKey) ||
    BACKEND_FLATTEN_KEYS.has(canonical.replace(/\./g, "_"));

  if (inFrontend && inBackend) {
    return { status: "OK", reason: "Coberta em frontend resolver e backend flatten", optional: false };
  }
  if (inFrontend) {
    if (hasSnapshotValue) {
      return { status: "OK", reason: "Resolvida no frontend com valor no snapshot", optional: false };
    }
    return { status: "OK", reason: "Resolvida no frontend resolver", optional: false };
  }
  if (inBackend) {
    if (hasSnapshotValue) {
      return { status: "OK", reason: "Resolvida no backend flatten com valor no snapshot", optional: false };
    }
    return { status: "FALLBACK", reason: "Presente no backend flatten, valor depende do snapshot", optional: false };
  }

  // ── 8. Only snapshot value (no explicit resolver) ──
  if (hasSnapshotValue) {
    return { status: "FALLBACK", reason: "Resolvida apenas via snapshot (sem resolver explícito)", optional: false };
  }

  // ── 9. CDD group (explicitly not implemented) ──
  if (group === "cdd") {
    return { status: "ERROR", reason: "Grupo CDD não implementado", optional: true };
  }

  // ── 10. No coverage at all ──
  return { status: "ERROR", reason: "Sem resolver, sem valor no snapshot — placeholder ficará vazio", optional: false };
}
