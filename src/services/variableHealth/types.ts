/**
 * Types for the Variable Health Engine.
 * Calculates health scores from historical audit reports.
 */

export type HealthClassification =
  | "healthy"      // >80% OK
  | "unstable"     // 30-80% OK
  | "critical"     // <30% OK
  | "unused"       // Never seen in any report
  | "legacy"       // Marked as legacy
  | "duplicate_candidate"; // Potential duplicate

export interface VariableHealthRecord {
  key: string;
  totalExecutions: number;
  totalOk: number;
  totalNull: number;
  totalBroken: number;
  /** 0-100 score: (ok / totalExecutions) * 100 */
  healthScore: number;
  classification: HealthClassification;
  /** How many consecutive recent reports it was broken */
  consecutiveBrokenStreak: number;
  /** Always returns null/dash? */
  alwaysNull: boolean;
  /** First seen in reports */
  firstSeenAt: string | null;
  /** Last seen in reports */
  lastSeenAt: string | null;
}

export interface VariableHealthSummary {
  totalVariables: number;
  healthy: number;
  unstable: number;
  critical: number;
  unused: number;
  totalReportsAnalyzed: number;
}
