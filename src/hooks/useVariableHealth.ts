/**
 * Hook for variable health scores based on real generation data.
 * §16: Queries only in hooks
 * §23: staleTime obrigatório
 * 
 * Priority: generation_audit_json (real generation) > variable_audit_reports (parallel audit)
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
import type { GenerationAuditReport } from "@/services/generationAudit/types";
import { useQuickAudit, type QuickAuditResult } from "@/hooks/useRealAudit";

const STALE_TIME = 1000 * 60 * 5; // 5 min

/**
 * Fetch historical audit reports (last 50) from variable_audit_reports.
 * Used as fallback when generation_audit_json is unavailable.
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
        return [] as AuditReportRow[];
      }

      return (data ?? []) as AuditReportRow[];
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Fetch real generation audit data from proposta_versoes.generation_audit_json.
 * This is the primary source of truth for variable health.
 */
function useGenerationAuditReports() {
  return useQuery({
    queryKey: ["generation-audit-health"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("generation_audit_json, created_at")
        .not("generation_audit_json", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        return [] as Array<{ report: GenerationAuditReport; created_at: string }>;
      }

      return (data ?? [])
        .map((row: any) => ({
          report: row.generation_audit_json as GenerationAuditReport | null,
          created_at: row.created_at as string,
        }))
        .filter((r) => r.report !== null) as Array<{ report: GenerationAuditReport; created_at: string }>;
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Convert generation_audit_json reports into AuditReportRow format
 * so they can be fed into the existing health engine.
 */
function convertGenerationToAuditRows(
  genReports: Array<{ report: GenerationAuditReport; created_at: string }>
): AuditReportRow[] {
  return genReports.map((g, idx) => {
    const r = g.report;
    const broken = r.unresolvedPlaceholders ?? [];
    const nullVars = r.nullValues ?? [];
    const allFound = r.items.map((i) => i.variable);

    return {
      id: `gen-${idx}`,
      variaveis_encontradas: allFound,
      variaveis_quebradas: broken,
      variaveis_nulas: nullVars,
      criado_em: g.created_at,
    };
  });
}

/**
 * Convert quick audit result into a single AuditReportRow
 * for instant health computation when no historical data exists.
 */
function convertQuickAuditToRow(qa: QuickAuditResult): AuditReportRow {
  return {
    id: "quick-audit-live",
    variaveis_encontradas: qa.variaveis_encontradas ?? [],
    variaveis_quebradas: qa.quebradas ?? [],
    variaveis_nulas: qa.nulas ?? [],
    criado_em: qa.gerado_em ?? new Date().toISOString(),
  };
}

export interface VariableHealthResult {
  healthMap: Map<string, VariableHealthRecord>;
  summary: VariableHealthSummary;
  getHealth: (key: string) => VariableHealthRecord | undefined;
  isLoading: boolean;
  hasData: boolean;
}

/**
 * Main hook: provides variable health scores.
 * Priority:
 *   1. generation_audit_json (real generation results from DB)
 *   2. variable_audit_reports (legacy parallel audit from DB)
 *   3. Quick audit (instant, from edge function) — NEW fallback
 */
export function useVariableHealth(): VariableHealthResult {
  const { data: legacyReports = [], isLoading: legacyLoading } = useHistoricalAuditReports();
  const { data: genReports = [], isLoading: genLoading } = useGenerationAuditReports();
  const { data: quickAudit, isLoading: quickLoading } = useQuickAudit();

  const isLoading = legacyLoading || genLoading || quickLoading;

  const catalogKeys = useMemo(() => {
    return VARIABLES_CATALOG.map((v) => v.legacyKey.replace(/^\[|\]$/g, ""));
  }, []);

  const healthMap = useMemo(() => {
    // Priority 1: use generation_audit_json if available
    if (genReports.length > 0) {
      const convertedRows = convertGenerationToAuditRows(genReports);
      return buildVariableHealthMap(convertedRows, catalogKeys);
    }
    // Priority 2: legacy parallel audit reports
    if (legacyReports.length > 0) {
      return buildVariableHealthMap(legacyReports, catalogKeys);
    }
    // Priority 3: Quick audit instant fallback — compute from live data
    if (quickAudit && quickAudit.variaveis_encontradas?.length > 0) {
      const row = convertQuickAuditToRow(quickAudit);
      return buildVariableHealthMap([row], catalogKeys);
    }
    return buildVariableHealthMap([], catalogKeys);
  }, [genReports, legacyReports, quickAudit, catalogKeys]);

  const totalReports = genReports.length > 0
    ? genReports.length
    : legacyReports.length > 0
      ? legacyReports.length
      : (quickAudit?.variaveis_encontradas?.length ?? 0) > 0 ? 1 : 0;

  const summary = useMemo(() => {
    return buildHealthSummary(healthMap, totalReports);
  }, [healthMap, totalReports]);

  const getHealth = (key: string) => healthMap.get(key);

  return {
    healthMap,
    summary,
    getHealth,
    isLoading,
    hasData: totalReports > 0,
  };
}

export type { VariableHealthRecord, VariableHealthSummary, HealthClassification };
