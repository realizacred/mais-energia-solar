/**
 * Variable Health Engine
 * Computes health scores from historical audit reports.
 * 100% evidence-based — no assumptions.
 */

import type { VariableHealthRecord, HealthClassification, VariableHealthSummary } from "./types";

export interface AuditReportRow {
  id: string;
  variaveis_encontradas: string[] | null;
  variaveis_quebradas: string[] | null;
  variaveis_nulas: string[] | null;
  criado_em: string;
}

/**
 * Build health map from historical audit reports.
 * Each report contains which variables were found, broken, and null.
 */
export function buildVariableHealthMap(
  reports: AuditReportRow[],
  allKnownKeys: string[],
): Map<string, VariableHealthRecord> {
  const map = new Map<string, VariableHealthRecord>();

  // Initialize all known keys as unused
  for (const key of allKnownKeys) {
    map.set(key, createEmptyRecord(key));
  }

  if (reports.length === 0) return map;

  // Filter out stale reports older than 30 days to avoid persistent false criticals
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentReports = reports.filter(
    (r) => new Date(r.criado_em).getTime() >= thirtyDaysAgo
  );

  if (recentReports.length === 0) return map;

  // Sort reports oldest first for streak calculation
  const sorted = [...recentReports].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
  );

  for (const report of sorted) {
    const encontradas = new Set(report.variaveis_encontradas ?? []);
    const quebradas = new Set(report.variaveis_quebradas ?? []);
    const nulas = new Set(report.variaveis_nulas ?? []);

    for (const key of encontradas) {
      if (!map.has(key)) {
        map.set(key, createEmptyRecord(key));
      }
      const rec = map.get(key)!;
      rec.totalExecutions++;

      if (quebradas.has(key)) {
        rec.totalBroken++;
        rec.consecutiveBrokenStreak++;
      } else if (nulas.has(key)) {
        rec.totalNull++;
        rec.consecutiveBrokenStreak = 0; // reset streak
      } else {
        rec.totalOk++;
        rec.consecutiveBrokenStreak = 0;
      }

      if (!rec.firstSeenAt) rec.firstSeenAt = report.criado_em;
      rec.lastSeenAt = report.criado_em;
    }
  }

  // Compute scores and classifications
  for (const rec of map.values()) {
    if (rec.totalExecutions === 0) {
      rec.healthScore = 0;
      rec.classification = "unused";
      continue;
    }

    rec.healthScore = Math.round((rec.totalOk / rec.totalExecutions) * 100);
    rec.alwaysNull = rec.totalNull === rec.totalExecutions;
    rec.classification = classifyHealth(rec);
  }

  return map;
}

function classifyHealth(rec: VariableHealthRecord): HealthClassification {
  if (rec.totalExecutions === 0) return "unused";
  if (rec.healthScore > 80) return "healthy";
  if (rec.healthScore >= 30) return "unstable";
  return "critical";
}

function createEmptyRecord(key: string): VariableHealthRecord {
  return {
    key,
    totalExecutions: 0,
    totalOk: 0,
    totalNull: 0,
    totalBroken: 0,
    healthScore: 0,
    classification: "unused",
    consecutiveBrokenStreak: 0,
    alwaysNull: false,
    firstSeenAt: null,
    lastSeenAt: null,
  };
}

/**
 * Build summary from health map.
 */
export function buildHealthSummary(
  healthMap: Map<string, VariableHealthRecord>,
  totalReports: number,
): VariableHealthSummary {
  let healthy = 0;
  let unstable = 0;
  let critical = 0;
  let unused = 0;

  for (const rec of healthMap.values()) {
    switch (rec.classification) {
      case "healthy": healthy++; break;
      case "unstable": unstable++; break;
      case "critical": critical++; break;
      case "unused": unused++; break;
    }
  }

  return {
    totalVariables: healthMap.size,
    healthy,
    unstable,
    critical,
    unused,
    totalReportsAnalyzed: totalReports,
  };
}
