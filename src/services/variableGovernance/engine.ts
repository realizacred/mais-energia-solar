/**
 * Variable Governance Engine
 * Computes governance records, summary, and catalog health.
 */

import { VARIABLES_CATALOG, type CatalogVariable } from "@/lib/variablesCatalog";
import { classifyGovernance } from "./classifier";
import type {
  GovernanceRecord,
  GovernanceSummary,
  GovernanceClass,
  CatalogHealthScore,
  CatalogHealthLevel,
} from "./types";

/**
 * Run governance classification on ALL catalog variables.
 */
export function runGovernanceClassification(
  customVarKeys: Set<string>,
  dynamicFieldKeys: Set<string>,
): GovernanceRecord[] {
  return VARIABLES_CATALOG.map((v) =>
    classifyGovernance(v, customVarKeys, dynamicFieldKeys)
  );
}

/**
 * Build governance summary from records.
 */
export function buildGovernanceSummary(records: GovernanceRecord[]): GovernanceSummary {
  const counts: Record<GovernanceClass, number> = {
    IMPLEMENTADA: 0,
    PARCIAL_BE_ONLY: 0,
    PARCIAL_FE_ONLY: 0,
    CUSTOM_BACKEND: 0,
    CUSTOM_IMPL: 0,
    INPUT_WIZARD: 0,
    ALIAS_LEGADO: 0,
    TEMPLATE_LEGADO: 0,
    FEATURE_NAO_IMPLEMENTADA: 0,
    DOCUMENTO: 0,
    CDD: 0,
    MAPEAVEL: 0,
    PASSTHROUGH: 0,
    FANTASMA_REAL: 0,
  };

  for (const r of records) {
    counts[r.classification]++;
  }

  const total = records.length;
  const catalogHealth = computeCatalogHealth(counts, total);

  return {
    total,
    implementada: counts.IMPLEMENTADA,
    parcial_be_only: counts.PARCIAL_BE_ONLY,
    parcial_fe_only: counts.PARCIAL_FE_ONLY,
    custom_backend: counts.CUSTOM_BACKEND,
    custom_impl: counts.CUSTOM_IMPL,
    input_wizard: counts.INPUT_WIZARD,
    alias_legado: counts.ALIAS_LEGADO,
    template_legado: counts.TEMPLATE_LEGADO,
    feature_nao_implementada: counts.FEATURE_NAO_IMPLEMENTADA,
    documento: counts.DOCUMENTO,
    cdd: counts.CDD,
    mapeavel: counts.MAPEAVEL,
    passthrough: counts.PASSTHROUGH,
    fantasma_real: counts.FANTASMA_REAL,
    catalogHealth,
  };
}

function computeCatalogHealth(
  counts: Record<GovernanceClass, number>,
  total: number,
): CatalogHealthScore {
  if (total === 0) {
    return { level: "critica", score: 0, implementedPct: 0, beOnlyPct: 0, customPct: 0, legacyPct: 0, ghostPct: 0, featurePendingPct: 0 };
  }

  const implemented = counts.IMPLEMENTADA + counts.PASSTHROUGH + counts.CUSTOM_IMPL + counts.DOCUMENTO + counts.INPUT_WIZARD;
  const beOnly = counts.PARCIAL_BE_ONLY;
  const custom = counts.CUSTOM_BACKEND;
  const legacy = counts.ALIAS_LEGADO + counts.TEMPLATE_LEGADO;
  const ghost = counts.FANTASMA_REAL;
  const featurePending = counts.FEATURE_NAO_IMPLEMENTADA + counts.CDD;

  const implementedPct = Math.round((implemented / total) * 100);
  const beOnlyPct = Math.round((beOnly / total) * 100);
  const customPct = Math.round((custom / total) * 100);
  const legacyPct = Math.round((legacy / total) * 100);
  const ghostPct = Math.round((ghost / total) * 100);
  const featurePendingPct = Math.round((featurePending / total) * 100);

  // Score: weighted — higher is better
  // Functional (impl + beOnly + custom + passthrough) contributes positively
  // Ghosts and legacy detract
  const functionalPct = Math.round(((implemented + beOnly + custom) / total) * 100);
  const score = Math.max(0, Math.min(100, functionalPct - ghostPct * 2));

  let level: CatalogHealthLevel;
  if (score >= 70) level = "saudavel";
  else if (score >= 40) level = "atencao";
  else level = "critica";

  return { level, score, implementedPct, beOnlyPct, customPct, legacyPct, ghostPct, featurePendingPct };
}

/**
 * Get template validation results — which variables should NOT be in new templates.
 */
export function getTemplateBlockedVars(records: GovernanceRecord[]): GovernanceRecord[] {
  return records.filter(r => r.templateWarning === "block");
}

/**
 * Get template warned vars — allowed but should be reviewed.
 */
export function getTemplateWarnedVars(records: GovernanceRecord[]): GovernanceRecord[] {
  return records.filter(r => r.templateWarning === "warn");
}
