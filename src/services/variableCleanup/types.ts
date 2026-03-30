/**
 * Variable Cleanup Engine — Types
 * Controlled cleanup, deprecation, and migration system.
 */

/** Cleanup safety classification */
export type CleanupSafety =
  | "SAFE_TO_HIDE"              // Can be hidden from default UI
  | "SAFE_TO_ALIAS"             // Can be replaced by alias
  | "SAFE_TO_REPLACE_IN_TEMPLATE" // Can be auto-replaced in templates
  | "SAFE_TO_DELETE_LATER"      // No usage — can be queued for deletion
  | "NOT_SAFE";                 // In active use — do not touch

/** Variable usage map entry */
export interface VariableUsageRecord {
  key: string;
  /** Used in active proposal templates */
  usedInActiveTemplates: boolean;
  /** Used in legacy/old templates */
  usedInLegacyTemplates: boolean;
  /** Used in recent generations (last 30 days) */
  usedRecently: boolean;
  /** Total usage count across all sources */
  usageCount: number;
  /** Last time this variable was seen in a generation */
  lastUsedAt: string | null;
}

/** Deprecation metadata */
export interface DeprecationInfo {
  deprecated: boolean;
  replacementKey?: string;
  deprecatedSince?: string;
  reason?: string;
}

/** Migration log entry */
export interface MigrationLogEntry {
  variableKey: string;
  action: "replaced" | "hidden" | "deprecated" | "alias_created";
  templateId?: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
  reversible: boolean;
}

/** Full cleanup record for a variable */
export interface CleanupRecord {
  key: string;
  label: string;
  safety: CleanupSafety;
  deprecation: DeprecationInfo;
  usage: VariableUsageRecord;
  /** Why this safety level was assigned */
  safetyReason: string;
  /** Whether deletion is possible */
  canDelete: boolean;
  /** Suggested replacement if applicable */
  replacementKey?: string;
}

/** Cleanup summary */
export interface CleanupSummary {
  total: number;
  safeToHide: number;
  safeToAlias: number;
  safeToReplace: number;
  safeToDelete: number;
  notSafe: number;
  deprecated: number;
  hidden: number;
}
