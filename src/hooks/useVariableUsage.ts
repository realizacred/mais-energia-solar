/**
 * Hook for accessing variable usage data.
 * Replaces hardcoded DOCX_REAL_VARS / DOCX_BROKEN / DOCX_NULL_VARS
 * with a centralized, reusable source.
 * 
 * §16: Queries only in hooks
 * §23: staleTime obrigatório
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildVariableUsageMap,
  buildUsageSummary,
  type VariableUsageInfo,
  type VariableUsageSummary,
} from "@/services/variableUsage";
import type { GenerationAuditReport } from "@/services/generationAudit/types";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";

const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Fetches the latest generation audit reports stored in proposta_versoes.
 * Falls back to empty array if no data.
 */
function useLatestAuditReports() {
  return useQuery({
    queryKey: ["generation-audit-reports-latest"],
    queryFn: async () => {
      // Check if generation_audit_json column exists by trying the query
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("generation_audit_json")
        .not("generation_audit_json", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        // Column may not exist yet — graceful fallback
        return [] as GenerationAuditReport[];
      }

      return (data ?? [])
        .map((row: any) => row.generation_audit_json as GenerationAuditReport | null)
        .filter(Boolean) as GenerationAuditReport[];
    },
    staleTime: STALE_TIME,
  });
}

export interface VariableUsageResult {
  /** Map of variable key -> usage info */
  usageMap: Map<string, VariableUsageInfo>;
  /** Summary statistics */
  summary: VariableUsageSummary;
  /** Get usage info for a specific variable */
  getUsage: (key: string) => VariableUsageInfo | undefined;
  /** Check if variable is in any DOCX */
  isInDocx: (key: string) => boolean;
  /** Check if variable has known error */
  hasError: (key: string) => boolean;
  /** Check if variable has known warning (null value) */
  hasWarning: (key: string) => boolean;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Main hook: provides variable usage data from generation audit reports.
 * Falls back to known-issues baseline when no reports available.
 */
export function useVariableUsage(): VariableUsageResult {
  const { data: reports = [], isLoading } = useLatestAuditReports();

  const catalogKeys = useMemo(() => {
    return VARIABLES_CATALOG.map((v) => v.legacyKey.replace(/^\[|\]$/g, ""));
  }, []);

  const usageMap = useMemo(() => {
    return buildVariableUsageMap(reports, catalogKeys);
  }, [reports, catalogKeys]);

  const summary = useMemo(() => {
    const lastDate = reports.length > 0 ? reports[0]?.generatedAt : null;
    return buildUsageSummary(usageMap, lastDate);
  }, [usageMap, reports]);

  const getUsage = (key: string) => usageMap.get(key);
  const isInDocx = (key: string) => usageMap.get(key)?.inDocx ?? false;
  const hasError = (key: string) => usageMap.get(key)?.isBroken ?? false;
  const hasWarning = (key: string) => usageMap.get(key)?.isNull ?? false;

  return { usageMap, summary, getUsage, isInDocx, hasError, hasWarning, isLoading };
}
