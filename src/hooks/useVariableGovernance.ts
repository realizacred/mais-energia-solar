/**
 * Hook for variable governance classification.
 * Centralizes all governance logic — SSOT.
 * §16: Queries only in hooks
 */

import { useMemo } from "react";
import {
  runGovernanceClassification,
  buildGovernanceSummary,
  type GovernanceRecord,
  type GovernanceSummary,
  type GovernanceClass,
} from "@/services/variableGovernance";
import type { VariavelCustom } from "@/hooks/useVariaveisCustom";

export type GovernanceFilter =
  | "todas"
  | "implementada"
  | "be_only"
  | "fe_only"
  | "custom"
  | "input_wizard"
  | "legado"
  | "documento"
  | "cdd"
  | "futura"
  | "mapeavel"
  | "passthrough"
  | "fantasma"
  | "safe_template"
  | "warn_template"
  | "block_template";

export interface GovernanceFilterOption {
  key: GovernanceFilter;
  label: string;
  count: number;
  icon?: string;
}

export interface UseVariableGovernanceResult {
  records: GovernanceRecord[];
  summary: GovernanceSummary;
  getRecord: (key: string) => GovernanceRecord | undefined;
  filterOptions: GovernanceFilterOption[];
  filterRecords: (filter: GovernanceFilter) => GovernanceRecord[];
}

/**
 * Main governance hook — classifies all catalog variables.
 */
export function useVariableGovernance(
  customVars: VariavelCustom[],
  dynamicFieldKeys?: string[],
): UseVariableGovernanceResult {
  const customVarKeys = useMemo(() => {
    return new Set(customVars.map((cv) => cv.nome));
  }, [customVars]);

  const dynamicKeys = useMemo(() => {
    return new Set(dynamicFieldKeys ?? []);
  }, [dynamicFieldKeys]);

  const records = useMemo(() => {
    return runGovernanceClassification(customVarKeys, dynamicKeys);
  }, [customVarKeys, dynamicKeys]);

  const summary = useMemo(() => {
    return buildGovernanceSummary(records);
  }, [records]);

  const recordMap = useMemo(() => {
    const map = new Map<string, GovernanceRecord>();
    for (const r of records) map.set(r.key, r);
    return map;
  }, [records]);

  const getRecord = (key: string) => recordMap.get(key);

  const filterRecords = (filter: GovernanceFilter): GovernanceRecord[] => {
    if (filter === "todas") return records;
    const classMap: Partial<Record<GovernanceFilter, GovernanceClass[]>> = {
      implementada: ["IMPLEMENTADA"],
      be_only: ["PARCIAL_BE_ONLY"],
      fe_only: ["PARCIAL_FE_ONLY"],
      custom: ["CUSTOM_BACKEND", "CUSTOM_IMPL"],
      input_wizard: ["INPUT_WIZARD"],
      legado: ["ALIAS_LEGADO", "TEMPLATE_LEGADO"],
      documento: ["DOCUMENTO"],
      cdd: ["CDD"],
      futura: ["FEATURE_NAO_IMPLEMENTADA"],
      mapeavel: ["MAPEAVEL"],
      passthrough: ["PASSTHROUGH"],
      fantasma: ["FANTASMA_REAL"],
    };

    const classes = classMap[filter];
    if (classes) return records.filter(r => (classes as string[]).includes(r.classification));

    // Template filters
    if (filter === "safe_template") return records.filter(r => r.safeForNewTemplates);
    if (filter === "warn_template") return records.filter(r => r.templateWarning === "warn");
    if (filter === "block_template") return records.filter(r => r.templateWarning === "block");

    return records;
  };

  const filterOptions = useMemo((): GovernanceFilterOption[] => {
    const s = summary;
    return ([
      { key: "todas" as GovernanceFilter, label: "Todas", count: s.total },
      { key: "implementada" as GovernanceFilter, label: "🟢 Implementadas", count: s.implementada },
      { key: "be_only" as GovernanceFilter, label: "🟡 Backend/Snapshot", count: s.parcial_be_only },
      { key: "passthrough" as GovernanceFilter, label: "🔵 Passthrough", count: s.passthrough },
      { key: "custom" as GovernanceFilter, label: "🧩 Custom", count: s.custom_backend + s.custom_impl },
      { key: "input_wizard" as GovernanceFilter, label: "📥 Input Wizard", count: s.input_wizard },
      { key: "documento" as GovernanceFilter, label: "📄 Documento", count: s.documento },
      { key: "fe_only" as GovernanceFilter, label: "🟠 Só Frontend", count: s.parcial_fe_only },
      { key: "mapeavel" as GovernanceFilter, label: "🟠 Mapeáveis", count: s.mapeavel },
      { key: "legado" as GovernanceFilter, label: "🏚️ Legado", count: s.alias_legado + s.template_legado },
      { key: "futura" as GovernanceFilter, label: "🟣 Futuras", count: s.feature_nao_implementada },
      { key: "cdd" as GovernanceFilter, label: "🔗 CDD", count: s.cdd },
      { key: "fantasma" as GovernanceFilter, label: "🔴 Fantasmas", count: s.fantasma_real },
      { key: "block_template" as GovernanceFilter, label: "🚫 Bloquear Template", count: records.filter(r => r.templateWarning === "block").length },
    ] as GovernanceFilterOption[]).filter(o => o.count > 0 || o.key === "todas");
  }, [summary, records]);

  return { records, summary, getRecord, filterOptions, filterRecords };
}

export type { GovernanceRecord, GovernanceSummary, GovernanceClass };
