/**
 * Types for the Variable Usage service.
 * Centralizes variable status, DOCX usage, and generation audit data.
 */

export type VariableRealStatus =
  | "ok_resolver"       // Resolved explicitly by FE/BE resolver
  | "ok_snapshot"       // Resolved via snapshot passthrough
  | "ok_custom"         // Custom variable evaluated successfully
  | "warning_null"      // Variable exists but returned null
  | "error_unresolved"  // Placeholder not resolved (broken)
  | "pending"           // Not implemented yet
  | "unused_real";      // Genuinely unused — not in DOCX, no evidence

export interface VariableUsageInfo {
  /** Variable key (e.g. "valor_total", "vc_aumento") */
  key: string;
  /** Is this variable found in any active DOCX template? */
  inDocx: boolean;
  /** Is this variable known to be broken (unresolved placeholder)? */
  isBroken: boolean;
  /** Is this variable known to return null? */
  isNull: boolean;
  /** Number of active templates using this variable */
  templateCount: number;
  /** Real status classification */
  realStatus: VariableRealStatus;
  /** Source of evidence */
  evidenceSource: "generation_audit" | "docx_extraction" | "catalog" | "none";
}

export interface VariableUsageSummary {
  totalInDocx: number;
  totalOk: number;
  totalBroken: number;
  totalNull: number;
  totalTemplates: number;
  lastAuditDate: string | null;
}
