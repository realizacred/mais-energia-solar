export { runGovernanceClassification, buildGovernanceSummary, getTemplateBlockedVars, getTemplateWarnedVars } from "./engine";
export { classifyGovernance } from "./classifier";
export { validateVariableGovernance, validateAllGovernance, detectCatalogDuplicates } from "./validator";
export type {
  GovernanceClass,
  GovernanceRecord,
  GovernanceSummary,
  GovernanceSuggestion,
  GovernanceValidationError,
  CleanupReadiness,
  CatalogHealthScore,
  CatalogHealthLevel,
} from "./types";
