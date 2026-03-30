/**
 * Variable Governance Engine — Types
 * Centralized classification system for all variables.
 */

import type { VariableDomain, VariableNature } from "@/lib/variablesCatalog";

/** Real governance classification for each variable */
export type GovernanceClass =
  | "IMPLEMENTADA"             // FE + BE both resolve
  | "PARCIAL_BE_ONLY"          // BE resolves, FE relies on snapshot fallback
  | "PARCIAL_FE_ONLY"          // FE resolves, BE doesn't
  | "CUSTOM_BACKEND"           // evaluateExpression on backend
  | "CUSTOM_IMPL"              // custom var with working expression
  | "INPUT_WIZARD"             // depends on wizard input field
  | "ALIAS_LEGADO"             // old name for something that exists under a modern key
  | "TEMPLATE_LEGADO"          // placeholder in old templates, should be replaced
  | "FEATURE_NAO_IMPLEMENTADA" // CDD, layout engine, etc.
  | "DOCUMENTO"                // contrato/assinatura/pagamento scope
  | "CDD"                      // distributor fields (not implemented)
  | "MAPEAVEL"                 // data exists in system but not wired to resolver
  | "PASSTHROUGH"              // resolved via snapshot deepGet (series, tabelas, premissas)
  | "FANTASMA_REAL";           // truly orphaned — no data source, no alias, no feature

/** Cleanup readiness flags */
export interface CleanupReadiness {
  segura_para_ocultar: boolean;
  segura_para_substituir_em_template: boolean;
  segura_para_alias: boolean;
  segura_para_limpeza_futura: boolean;
}

/** Suggestion for fixing an invalid variable */
export interface GovernanceSuggestion {
  type: "alias" | "replace_template" | "add_input" | "add_resolver" | "use_modern" | "future_feature";
  message: string;
  /** Suggested replacement key if applicable */
  replacementKey?: string;
}

/** Full governance record for a variable */
export interface GovernanceRecord {
  key: string;
  label: string;
  category: string;
  /** Functional domain (proposta, cliente, financeiro, etc.) */
  domain: VariableDomain;
  /** Nature/origin of the variable */
  nature: VariableNature;
  classification: GovernanceClass;
  /** Human-readable status label for UI (replaces "sem resolver") */
  statusLabel: string;
  /** Color token for UI badge */
  statusColor: "success" | "info" | "warning" | "muted" | "destructive" | "primary" | "secondary";
  /** Evidence for classification */
  evidence: string;
  /** Whether it's safe for new templates */
  safeForNewTemplates: boolean;
  /** Template warning level: none, warn, block */
  templateWarning: "none" | "warn" | "block";
  /** Cleanup readiness */
  cleanup: CleanupReadiness;
  /** Suggestions for fixing */
  suggestions: GovernanceSuggestion[];
  /** Is this variable in FE resolver (explicit) */
  inFE: boolean;
  /** Is this variable in BE resolver (explicit) */
  inBE: boolean;
  /** Is custom var from DB */
  isCustom: boolean;
  /** Is document-scope variable */
  isDocument: boolean;
  /** Is legacy/alias */
  isLegacy: boolean;
  /** Is passthrough group (series, tabelas, premissas) */
  isPassthrough: boolean;
}

/** Governance validation error */
export interface GovernanceValidationError {
  key: string;
  rule: string;
  message: string;
}

/** Catalog health score */
export type CatalogHealthLevel = "saudavel" | "atencao" | "critica";

export interface CatalogHealthScore {
  level: CatalogHealthLevel;
  score: number; // 0-100
  implementedPct: number;
  beOnlyPct: number;
  customPct: number;
  legacyPct: number;
  ghostPct: number;
  featurePendingPct: number;
}

/** Summary statistics */
export interface GovernanceSummary {
  total: number;
  implementada: number;
  parcial_be_only: number;
  parcial_fe_only: number;
  custom_backend: number;
  custom_impl: number;
  input_wizard: number;
  alias_legado: number;
  template_legado: number;
  feature_nao_implementada: number;
  documento: number;
  cdd: number;
  mapeavel: number;
  passthrough: number;
  fantasma_real: number;
  catalogHealth: CatalogHealthScore;
}
