export { runVariableAudit, auditToCSV } from "./engine";
export {
  validateTemplateVariables,
  extractPlaceholders,
} from "./templateValidator";
export type {
  ValidationStatus,
  ValidatedVariable,
  ValidationReport,
} from "./templateValidator";
export type {
  AuditRecord,
  AuditResult,
  AuditSummary,
  AuditStatus,
  AuditAction,
  GroupSummary,
  BacklogItem,
  SnapshotObservation,
  AnalysisMetadata,
} from "./types";
