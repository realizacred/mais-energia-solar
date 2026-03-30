/**
 * Variable Governance Validator
 * Validates domain/nature/source coherence for governance records.
 */

import type { GovernanceRecord, GovernanceValidationError } from "./types";
import type { VariableDomain, VariableNature } from "@/lib/variablesCatalog";

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

  return errors;
}

/**
 * Validate all governance records and return a summary.
 */
export function validateAllGovernance(records: GovernanceRecord[]): {
  valid: boolean;
  totalErrors: number;
  errors: GovernanceValidationError[];
} {
  const allErrors: GovernanceValidationError[] = [];
  for (const r of records) {
    allErrors.push(...validateVariableGovernance(r));
  }
  return {
    valid: allErrors.length === 0,
    totalErrors: allErrors.length,
    errors: allErrors,
  };
}
