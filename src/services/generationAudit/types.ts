/**
 * Types for the Generation Audit Engine.
 * Classifies variable resolution quality per proposal generation.
 */

export type GenerationVarStatus =
  | "ok"
  | "ok_snapshot"
  | "warning_null"
  | "warning_fallback"
  | "error_unresolved"
  | "error_missing_template_mapping";

export type GenerationSeverity = "ok" | "warning" | "error";

export type GenerationHealth = "saudavel" | "atencao" | "critica";

export interface GenerationVarAuditItem {
  variable: string;
  status: GenerationVarStatus;
  severity: GenerationSeverity;
  value: string | null;
  origin: string;
  message: string;
  suggestion?: string;
}

export interface GenerationAuditReport {
  /** Template used */
  templateId: string;
  templateName: string;
  /** Proposal reference */
  propostaId: string;
  versaoId?: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** Total placeholders found in template */
  totalPlaceholders: number;
  /** Breakdown */
  resolved: number;
  resolvedViaSnapshot: number;
  unresolvedPlaceholders: string[];
  nullValues: string[];
  emptyValues: string[];
  /** Classified items */
  items: GenerationVarAuditItem[];
  /** Overall score */
  healthScore: number; // 0-100
  health: GenerationHealth;
  /** Counts by severity */
  errorCount: number;
  warningCount: number;
  okCount: number;
}
