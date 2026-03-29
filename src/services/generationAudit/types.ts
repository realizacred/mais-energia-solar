/**
 * Types for the Generation Audit Engine.
 * Classifies variable resolution quality per proposal generation.
 */

export type GenerationVarStatus =
  | "ok"
  | "ok_snapshot"
  | "ok_custom"
  | "warning_null"
  | "warning_fallback"
  | "error_unresolved"
  | "error_expression"
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

/** Custom variable validation result from backend */
export interface CustomVarResult {
  nome: string;
  expressao: string;
  valor_calculado: string | null;
  /** true if evaluation failed (syntax error, NaN, Infinity, missing deps) */
  error?: boolean;
  error_message?: string;
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
  /** Custom variable results */
  customVarResults?: CustomVarResult[];
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
