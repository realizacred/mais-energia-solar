export {
  buildCleanupRecords,
  buildCleanupSummary,
  buildUsageRecord,
  classifyCleanupSafety,
  canDeleteVariable,
  getDeprecationInfo,
  isDeprecated,
  isHidden,
} from "./engine";
export type {
  CleanupSafety,
  CleanupRecord,
  CleanupSummary,
  VariableUsageRecord,
  DeprecationInfo,
  MigrationLogEntry,
} from "./types";
