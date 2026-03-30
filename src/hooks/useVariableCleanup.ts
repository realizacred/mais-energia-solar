/**
 * Hook for variable cleanup operations.
 * §16: Queries only in hooks
 * §23: staleTime obrigatório
 */

import { useMemo, useState, useCallback } from "react";
import {
  buildCleanupRecords,
  buildCleanupSummary,
  buildUsageRecord,
  isHidden,
  type CleanupRecord,
  type CleanupSummary,
  type CleanupSafety,
  type MigrationLogEntry,
} from "@/services/variableCleanup";
import type { GovernanceRecord } from "@/services/variableGovernance/types";
import type { VariableUsageInfo } from "@/services/variableUsage/types";

export type CleanupFilter = "all" | CleanupSafety;

export interface UseVariableCleanupResult {
  records: CleanupRecord[];
  summary: CleanupSummary;
  filterRecords: (filter: CleanupFilter) => CleanupRecord[];
  showHidden: boolean;
  setShowHidden: (v: boolean) => void;
  migrationLog: MigrationLogEntry[];
  addMigrationLog: (entry: MigrationLogEntry) => void;
}

/**
 * Main cleanup hook — combines governance + usage data for cleanup decisions.
 */
export function useVariableCleanup(
  govRecords: GovernanceRecord[],
  usageMap: Map<string, VariableUsageInfo>,
): UseVariableCleanupResult {
  const [showHidden, setShowHidden] = useState(false);
  const [migrationLog, setMigrationLog] = useState<MigrationLogEntry[]>([]);

  // Build usage records from usage map
  const usageRecordMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildUsageRecord>>();
    for (const [key, info] of usageMap) {
      map.set(key, buildUsageRecord(key, {
        inDocx: info.inDocx,
        templateCount: info.templateCount,
        lastUsedAt: null,
      }));
    }
    return map;
  }, [usageMap]);

  const records = useMemo(() => {
    const all = buildCleanupRecords(govRecords, usageRecordMap);
    if (showHidden) return all;
    return all.filter(r => !isHidden(r.key));
  }, [govRecords, usageRecordMap, showHidden]);

  const summary = useMemo(() => {
    return buildCleanupSummary(records);
  }, [records]);

  const filterRecords = useCallback((filter: CleanupFilter): CleanupRecord[] => {
    if (filter === "all") return records;
    return records.filter(r => r.safety === filter);
  }, [records]);

  const addMigrationLog = useCallback((entry: MigrationLogEntry) => {
    setMigrationLog(prev => [entry, ...prev]);
  }, []);

  return {
    records,
    summary,
    filterRecords,
    showHidden,
    setShowHidden,
    migrationLog,
    addMigrationLog,
  };
}
