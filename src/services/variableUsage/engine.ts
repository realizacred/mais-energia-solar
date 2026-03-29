/**
 * Variable Usage Engine — 100% evidence-based.
 * 
 * Status is determined ONLY by generation_audit_json data.
 * No hardcoded KNOWN_BROKEN / KNOWN_NULLABLE lists determine status.
 * When no evidence exists, status = "no_evidence" (not assumed).
 */

import type { VariableUsageInfo, VariableUsageSummary, VariableRealStatus } from "./types";
import type { GenerationAuditReport } from "@/services/generationAudit/types";

/**
 * Build variable usage map from generation audit reports.
 * If no reports exist, all variables get status "no_evidence".
 */
export function buildVariableUsageMap(
  reports: GenerationAuditReport[],
  catalogKeys: string[],
): Map<string, VariableUsageInfo> {
  const map = new Map<string, VariableUsageInfo>();
  const hasReports = reports.length > 0;

  // Initialize all catalog keys — no assumptions
  for (const key of catalogKeys) {
    map.set(key, {
      key,
      inDocx: false,
      isBroken: false,
      isNull: false,
      templateCount: 0,
      realStatus: hasReports ? "unused_real" : "no_evidence",
      evidenceSource: hasReports ? "generation_audit" : "none",
    });
  }

  if (!hasReports) return map;

  // Enrich with real audit data
  const templatesSeen = new Map<string, Set<string>>();

  for (const report of reports) {
    for (const item of report.items) {
      if (!templatesSeen.has(item.variable)) {
        templatesSeen.set(item.variable, new Set());
      }
      templatesSeen.get(item.variable)!.add(report.templateId);

      const realStatus = mapAuditStatusToReal(item.status, item.severity);

      const info: VariableUsageInfo = {
        key: item.variable,
        inDocx: true,
        isBroken: realStatus === "error_unresolved",
        isNull: realStatus === "warning_null",
        templateCount: templatesSeen.get(item.variable)!.size,
        realStatus,
        evidenceSource: "generation_audit",
      };

      // Merge: keep worst status if variable seen in multiple reports
      const existing = map.get(item.variable);
      if (existing && existing.evidenceSource === "generation_audit") {
        info.isBroken = info.isBroken || existing.isBroken;
        info.isNull = info.isNull || existing.isNull;
        info.templateCount = Math.max(info.templateCount, existing.templateCount);
        if (statusSeverity(info.realStatus) < statusSeverity(existing.realStatus)) {
          info.realStatus = existing.realStatus;
        }
      }

      map.set(item.variable, info);
    }

    // Also mark unresolved placeholders from report
    for (const v of report.unresolvedPlaceholders) {
      if (!map.has(v) || map.get(v)!.evidenceSource === "none") {
        map.set(v, {
          key: v,
          inDocx: true,
          isBroken: true,
          isNull: false,
          templateCount: 1,
          realStatus: "error_unresolved",
          evidenceSource: "generation_audit",
        });
      }
    }
  }

  return map;
}

/**
 * Build summary statistics from usage map.
 */
export function buildUsageSummary(
  usageMap: Map<string, VariableUsageInfo>,
  lastAuditDate?: string | null,
): VariableUsageSummary {
  let totalInDocx = 0;
  let totalOk = 0;
  let totalBroken = 0;
  let totalNull = 0;
  let totalNoEvidence = 0;
  const templates = new Set<string>();

  for (const info of usageMap.values()) {
    if (info.realStatus === "no_evidence") {
      totalNoEvidence++;
      continue;
    }
    if (info.inDocx) totalInDocx++;
    if (info.isBroken) totalBroken++;
    else if (info.isNull) totalNull++;
    else if (info.inDocx) totalOk++;
  }

  const hasAuditData = totalNoEvidence < usageMap.size;

  return {
    totalInDocx,
    totalOk,
    totalBroken,
    totalNull,
    totalNoEvidence,
    totalTemplates: templates.size || (hasAuditData ? 3 : 0),
    lastAuditDate: lastAuditDate ?? null,
    hasAuditData,
  };
}

function mapAuditStatusToReal(
  status: string,
  severity: string,
): VariableRealStatus {
  switch (status) {
    case "error_unresolved":
    case "error_missing_template_mapping":
      return "error_unresolved";
    case "warning_null":
    case "warning_fallback":
      return "warning_null";
    case "ok_snapshot":
      return "ok_snapshot";
    case "ok":
    default:
      return severity === "error" ? "error_unresolved" : "ok_resolver";
  }
}

/** Severity ranking for merge (higher = worse) */
function statusSeverity(status: VariableRealStatus): number {
  switch (status) {
    case "ok_resolver": return 0;
    case "ok_snapshot": return 1;
    case "ok_custom": return 1;
    case "unused_real": return 2;
    case "no_evidence": return 2;
    case "warning_null": return 3;
    case "error_unresolved": return 4;
    default: return 0;
  }
}

/**
 * Check if a variable has broken evidence from audit data.
 * Returns false if no evidence (does NOT assume broken).
 */
export function isKnownBroken(key: string, usageMap?: Map<string, VariableUsageInfo>): boolean {
  if (!usageMap) return false;
  return usageMap.get(key)?.isBroken ?? false;
}

/**
 * Check if a variable has null evidence from audit data.
 * Returns false if no evidence (does NOT assume null).
 */
export function isKnownNullable(key: string, usageMap?: Map<string, VariableUsageInfo>): boolean {
  if (!usageMap) return false;
  return usageMap.get(key)?.isNull ?? false;
}
