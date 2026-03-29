/**
 * Hook for variable health scores based on historical audit reports.
 * §16: Queries only in hooks
 * §23: staleTime obrigatório
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import {
  buildVariableHealthMap,
  buildHealthSummary,
  type AuditReportRow,
  type VariableHealthRecord,
  type VariableHealthSummary,
  type HealthClassification,
} from "@/services/variableHealth";

const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Fetch historical audit reports (last 50) from variable_audit_reports.
 */
function useHistoricalAuditReports() {
  return useQuery({
    queryKey: ["variable-audit-reports-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variable_audit_reports")
        .select("id, variaveis_encontradas, variaveis_quebradas, variaveis_nulas, criado_em")
        .order("criado_em", { ascending: false })
        .limit(50);

      if (error) {
        console.debug("[useVariableHealth] Error fetching reports:", error.message);
        return [] as AuditReportRow[];
      }

      return (data ?? []) as AuditReportRow[];
    },
    staleTime: STALE_TIME,
  });
}

export interface VariableHealthResult {
  healthMap: Map<string, VariableHealthRecord>;
  summary: VariableHealthSummary;
  getHealth: (key: string) => VariableHealthRecord | undefined;
  isLoading: boolean;
  hasData: boolean;
}

/**
 * Main hook: provides variable health scores from historical audit data.
 */
export function useVariableHealth(): VariableHealthResult {
  const { data: reports = [], isLoading } = useHistoricalAuditReports();

  const catalogKeys = useMemo(() => {
    return VARIABLES_CATALOG.map((v) => v.legacyKey.replace(/^\[|\]$/g, ""));
  }, []);

  const healthMap = useMemo(() => {
    return buildVariableHealthMap(reports, catalogKeys);
  }, [reports, catalogKeys]);

  const summary = useMemo(() => {
    return buildHealthSummary(healthMap, reports.length);
  }, [healthMap, reports]);

  const getHealth = (key: string) => healthMap.get(key);

  return {
    healthMap,
    summary,
    getHealth,
    isLoading,
    hasData: reports.length > 0,
  };
}

export type { VariableHealthRecord, VariableHealthSummary, HealthClassification };
