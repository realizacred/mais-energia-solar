/**
 * Variable Usage Engine — centralizes real-world variable usage data.
 * 
 * Replaces hardcoded DOCX_REAL_VARS / DOCX_BROKEN / DOCX_NULL_VARS
 * with a single source of truth that can be fed by:
 * 1. Generation audit reports (from template-preview)
 * 2. Stored audit metadata (from proposta_versoes)
 * 3. Fallback known-issues registry
 */

import type { VariableUsageInfo, VariableUsageSummary, VariableRealStatus } from "./types";
import type { GenerationAuditReport } from "@/services/generationAudit/types";

// ── Known broken placeholders (forensic audit - immutable truth) ──
const KNOWN_BROKEN: ReadonlySet<string> = new Set(["capo_m", "capo_seguro"]);

// ── Known nullable custom vars (forensic audit baseline) ──
const KNOWN_NULLABLE: ReadonlySet<string> = new Set([
  "vc_aumento", "vc_calculo_seguro", "vc_garantiaservico", "vc_string_box_cc",
]);

/**
 * Build variable usage map from generation audit reports.
 * If no reports are available, falls back to known-issues baseline.
 */
export function buildVariableUsageMap(
  reports: GenerationAuditReport[],
  catalogKeys: string[],
): Map<string, VariableUsageInfo> {
  const map = new Map<string, VariableUsageInfo>();

  // Initialize all catalog keys as unused
  for (const key of catalogKeys) {
    map.set(key, {
      key,
      inDocx: false,
      isBroken: KNOWN_BROKEN.has(key),
      isNull: KNOWN_NULLABLE.has(key),
      templateCount: 0,
      realStatus: classifyBaseStatus(key),
      evidenceSource: KNOWN_BROKEN.has(key) || KNOWN_NULLABLE.has(key) ? "catalog" : "none",
    });
  }

  // If we have generation audit reports, enrich with real data
  if (reports.length > 0) {
    const templatesSeen = new Map<string, Set<string>>(); // key -> set of templateIds

    for (const report of reports) {
      // Mark resolved vars as in-docx
      const allVarsInTemplate = new Set<string>();

      // Items from the report
      for (const item of report.items) {
        allVarsInTemplate.add(item.variable);
        const existing = map.get(item.variable);

        if (!templatesSeen.has(item.variable)) {
          templatesSeen.set(item.variable, new Set());
        }
        templatesSeen.get(item.variable)!.add(report.templateId);

        const info: VariableUsageInfo = {
          key: item.variable,
          inDocx: true,
          isBroken: item.status === "error_unresolved",
          isNull: item.status === "warning_null",
          templateCount: templatesSeen.get(item.variable)?.size ?? 1,
          realStatus: mapAuditStatusToReal(item.status, item.severity),
          evidenceSource: "generation_audit",
        };

        map.set(item.variable, info);
      }

      // Also mark resolved (OK) placeholders as in-docx
      // totalPlaceholders - items = resolved OK vars
      // We can infer from unresolvedPlaceholders + nullValues
      for (const v of report.unresolvedPlaceholders) {
        if (!map.has(v)) {
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
  }

  // Apply known-broken override (these are always broken regardless of reports)
  for (const key of KNOWN_BROKEN) {
    const existing = map.get(key);
    if (existing) {
      existing.isBroken = true;
      if (existing.realStatus !== "error_unresolved") {
        existing.realStatus = "error_unresolved";
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
  const templates = new Set<string>();

  for (const info of usageMap.values()) {
    if (info.inDocx) totalInDocx++;
    if (info.isBroken) totalBroken++;
    else if (info.isNull) totalNull++;
    else if (info.inDocx) totalOk++;
  }

  return {
    totalInDocx,
    totalOk,
    totalBroken,
    totalNull,
    totalTemplates: templates.size || 3, // fallback to known count
    lastAuditDate: lastAuditDate ?? null,
  };
}

function classifyBaseStatus(key: string): VariableRealStatus {
  if (KNOWN_BROKEN.has(key)) return "error_unresolved";
  if (KNOWN_NULLABLE.has(key)) return "warning_null";
  return "unused_real";
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

/**
 * Check if a variable is known broken (always true regardless of data).
 */
export function isKnownBroken(key: string): boolean {
  return KNOWN_BROKEN.has(key);
}

/**
 * Check if a variable is known nullable.
 */
export function isKnownNullable(key: string): boolean {
  return KNOWN_NULLABLE.has(key);
}
