/**
 * Types for the Variable Usage service.
 * 100% evidence-based — no hardcoded lists determine status.
 */

export type VariableRealStatus =
  | "ok_resolver"       // Resolved explicitly by FE/BE resolver
  | "ok_snapshot"       // Resolved via snapshot passthrough
  | "ok_custom"         // Custom variable evaluated successfully
  | "warning_null"      // Variable exists but returned null
  | "error_unresolved"  // Placeholder not resolved (broken)
  | "no_evidence"       // No generation data — status unknown
  | "unused_real";      // Not in any DOCX template per audit evidence

export type EvidenceSource =
  | "generation_audit"  // From real generation_audit_json
  | "none";             // No evidence available

export interface VariableUsageInfo {
  /** Variable key (e.g. "valor_total", "vc_aumento") */
  key: string;
  /** Is this variable found in any active DOCX template? Based on audit evidence only. */
  inDocx: boolean;
  /** Is this variable broken (unresolved placeholder) per audit evidence? */
  isBroken: boolean;
  /** Is this variable null per audit evidence? */
  isNull: boolean;
  /** Number of active templates using this variable (from audit) */
  templateCount: number;
  /** Real status classification — evidence-based only */
  realStatus: VariableRealStatus;
  /** Source of evidence for this classification */
  evidenceSource: EvidenceSource;
}

export interface VariableUsageSummary {
  totalInDocx: number;
  totalOk: number;
  totalBroken: number;
  totalNull: number;
  totalNoEvidence: number;
  totalTemplates: number;
  lastAuditDate: string | null;
  hasAuditData: boolean;
}
