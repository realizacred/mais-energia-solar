/**
 * Variable Governance Validator
 * Validates domain/nature/source coherence for governance records.
 * Also detects duplicate keys in the catalog.
 */

import type { GovernanceRecord, GovernanceValidationError } from "./types";
import type { VariableDomain, VariableNature, CatalogVariable } from "@/lib/variablesCatalog";

/** Valid domains — exhaustive */
const VALID_DOMAINS: Set<VariableDomain> = new Set([
  "proposta", "sistema_solar", "cliente", "conta_energia",
  "financeiro", "documento", "fornecedor", "projeto",
  "uc", "integracao", "tecnico", "legado",
]);

/** Valid natures — exhaustive */
const VALID_NATURES: Set<VariableNature> = new Set([
  "calculada", "snapshot", "input", "campo_custom_entidade",
  "integracao_externa", "documental", "alias_legado", "tecnica", "canonica",
]);

/** Incoherent combinations */
const FORBIDDEN_COMBINATIONS: Array<{ domain: VariableDomain; nature: VariableNature; reason: string }> = [
  { domain: "legado", nature: "calculada", reason: "Legado não pode ser calculada — deve ser alias_legado" },
  { domain: "documento", nature: "integracao_externa", reason: "Documento não vem de integração externa" },
];

/**
 * Validate a single governance record for coherence.
 */
export function validateVariableGovernance(record: GovernanceRecord): GovernanceValidationError[] {
  const errors: GovernanceValidationError[] = [];

  // Rule 1: domain must be valid
  if (!VALID_DOMAINS.has(record.domain)) {
    errors.push({
      key: record.key,
      rule: "INVALID_DOMAIN",
      message: `Domain "${record.domain}" não é válido. Permitidos: ${[...VALID_DOMAINS].join(", ")}`,
    });
  }

  // Rule 2: nature must be valid
  if (!VALID_NATURES.has(record.nature)) {
    errors.push({
      key: record.key,
      rule: "INVALID_NATURE",
      message: `Nature "${record.nature}" não é válida. Permitidas: ${[...VALID_NATURES].join(", ")}`,
    });
  }

  // Rule 3: check forbidden combinations
  for (const combo of FORBIDDEN_COMBINATIONS) {
    if (record.domain === combo.domain && record.nature === combo.nature) {
      errors.push({
        key: record.key,
        rule: "INCOHERENT_COMBINATION",
        message: combo.reason,
      });
    }
  }

  // Rule 4: category cannot drive domain (no "custom_calculada" or "campo_entidade" as domain)
  if ((record.domain as string) === "custom_calculada" || (record.domain as string) === "campo_entidade") {
    errors.push({
      key: record.key,
      rule: "CATEGORY_AS_DOMAIN",
      message: `Domain "${record.domain}" é baseado em categoria, não em domínio funcional real`,
    });
  }

  // Rule 5: FANTASMA_REAL without source is a CANONICAL_WITHOUT_SOURCE
  if (record.classification === "FANTASMA_REAL" && !record.inFE && !record.inBE && !record.isCustom) {
    errors.push({
      key: record.key,
      rule: "CANONICAL_WITHOUT_SOURCE",
      message: `Variável canônica sem fonte real — não tem resolver FE, BE, nem custom var`,
    });
  }

  return errors;
}

/**
 * Detect duplicate legacy keys in the catalog.
 */
export function detectCatalogDuplicates(catalog: CatalogVariable[]): GovernanceValidationError[] {
  const errors: GovernanceValidationError[] = [];
  const seenLegacy = new Map<string, number>();
  const seenCanonical = new Map<string, number>();

  for (const v of catalog) {
    const legacyCount = (seenLegacy.get(v.legacyKey) ?? 0) + 1;
    seenLegacy.set(v.legacyKey, legacyCount);
    if (legacyCount === 2) {
      errors.push({
        key: v.legacyKey.replace(/^\[|\]$/g, ""),
        rule: "DUPLICATE_LEGACY_KEY",
        message: `Legacy key "${v.legacyKey}" aparece mais de uma vez no catálogo`,
      });
    }

    const canonicalCount = (seenCanonical.get(v.canonicalKey) ?? 0) + 1;
    seenCanonical.set(v.canonicalKey, canonicalCount);
    if (canonicalCount === 2) {
      errors.push({
        key: v.canonicalKey.replace(/^\{\{|\}\}$/g, ""),
        rule: "DUPLICATE_CANONICAL_KEY",
        message: `Canonical key "${v.canonicalKey}" aparece mais de uma vez no catálogo`,
      });
    }
  }

  return errors;
}

/**
 * Validate all governance records and return a summary.
 */
export function validateAllGovernance(records: GovernanceRecord[], catalog?: CatalogVariable[]): {
  valid: boolean;
  totalErrors: number;
  errors: GovernanceValidationError[];
} {
  const allErrors: GovernanceValidationError[] = [];
  for (const r of records) {
    allErrors.push(...validateVariableGovernance(r));
  }

  // Catalog-level duplicate detection
  if (catalog) {
    allErrors.push(...detectCatalogDuplicates(catalog));
  }

  return {
    valid: allErrors.length === 0,
    totalErrors: allErrors.length,
    errors: allErrors,
  };
}
