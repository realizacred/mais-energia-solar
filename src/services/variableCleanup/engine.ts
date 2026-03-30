/**
 * Variable Cleanup Engine
 * Controlled cleanup with safety checks, deprecation, and migration.
 * §20: SRP — only cleanup logic here.
 */

import type {
  CleanupSafety,
  CleanupRecord,
  CleanupSummary,
  VariableUsageRecord,
  DeprecationInfo,
} from "./types";
import type { GovernanceRecord } from "@/services/variableGovernance/types";

// ── Deprecation registry (SSOT) ──

const DEPRECATED_VARS: Record<string, DeprecationInfo> = {
  capo_m: {
    deprecated: true,
    replacementKey: "modulo_garantia",
    deprecatedSince: "2026-03-30",
    reason: "Placeholder legado — usar [modulo_garantia] em templates novos",
  },
};

// ── Hidden variables (persisted in memory for session, could be DB-backed later) ──

const HIDDEN_VARS = new Set<string>();

/**
 * Get deprecation info for a variable.
 */
export function getDeprecationInfo(key: string): DeprecationInfo {
  return DEPRECATED_VARS[key] ?? { deprecated: false };
}

/**
 * Check if a variable is deprecated.
 */
export function isDeprecated(key: string): boolean {
  return !!DEPRECATED_VARS[key]?.deprecated;
}

/**
 * Check if a variable is hidden from default UI.
 */
export function isHidden(key: string): boolean {
  return HIDDEN_VARS.has(key);
}

/**
 * Build usage record from available data sources.
 * Falls back to safe defaults when no data exists.
 */
export function buildUsageRecord(
  key: string,
  auditData?: { inDocx: boolean; templateCount: number; lastUsedAt?: string | null },
): VariableUsageRecord {
  return {
    key,
    usedInActiveTemplates: auditData?.inDocx ?? false,
    usedInLegacyTemplates: false, // Would require template scanning
    usedRecently: !!auditData?.lastUsedAt,
    usageCount: auditData?.templateCount ?? 0,
    lastUsedAt: auditData?.lastUsedAt ?? null,
  };
}

/**
 * Classify cleanup safety for a variable based on governance + usage.
 */
export function classifyCleanupSafety(
  govRecord: GovernanceRecord,
  usage: VariableUsageRecord,
): { safety: CleanupSafety; reason: string } {
  // Active use → NOT_SAFE
  if (usage.usedInActiveTemplates && usage.usedRecently) {
    return {
      safety: "NOT_SAFE",
      reason: "Em uso ativo em templates e gerações recentes",
    };
  }

  // Governance cleanup flags
  if (govRecord.cleanup.segura_para_substituir_em_template && govRecord.suggestions.some(s => s.replacementKey)) {
    return {
      safety: "SAFE_TO_REPLACE_IN_TEMPLATE",
      reason: `Pode ser substituída por [${govRecord.suggestions.find(s => s.replacementKey)?.replacementKey}]`,
    };
  }

  if (govRecord.cleanup.segura_para_alias) {
    return {
      safety: "SAFE_TO_ALIAS",
      reason: "Alias legado — pode ser substituído pelo equivalente moderno",
    };
  }

  if (govRecord.cleanup.segura_para_limpeza_futura && usage.usageCount === 0) {
    return {
      safety: "SAFE_TO_DELETE_LATER",
      reason: "Fantasma real sem uso — pode ser removida futuramente",
    };
  }

  if (govRecord.cleanup.segura_para_ocultar) {
    return {
      safety: "SAFE_TO_HIDE",
      reason: "Pode ser ocultada da lista padrão sem impacto",
    };
  }

  // Fallback: if no active template use but exists in system
  if (!usage.usedInActiveTemplates && usage.usageCount === 0) {
    return {
      safety: "SAFE_TO_HIDE",
      reason: "Sem uso em templates ativos",
    };
  }

  return {
    safety: "NOT_SAFE",
    reason: "Em uso ou sem dados suficientes para classificar",
  };
}

/**
 * Check if a variable can be safely deleted.
 */
export function canDeleteVariable(
  usage: VariableUsageRecord,
  govRecord: GovernanceRecord,
): boolean {
  return (
    usage.usageCount === 0 &&
    !usage.usedInActiveTemplates &&
    !usage.usedInLegacyTemplates &&
    !usage.usedRecently &&
    govRecord.classification === "FANTASMA_REAL"
  );
}

/**
 * Build cleanup records from governance records + usage data.
 */
export function buildCleanupRecords(
  govRecords: GovernanceRecord[],
  usageMap: Map<string, VariableUsageRecord>,
): CleanupRecord[] {
  return govRecords.map((gov) => {
    const usage = usageMap.get(gov.key) ?? buildUsageRecord(gov.key);
    const { safety, reason } = classifyCleanupSafety(gov, usage);
    const deprecation = getDeprecationInfo(gov.key);
    const replacement = gov.suggestions.find(s => s.replacementKey)?.replacementKey;

    return {
      key: gov.key,
      label: gov.label,
      safety,
      deprecation,
      usage,
      safetyReason: reason,
      canDelete: canDeleteVariable(usage, gov),
      replacementKey: replacement,
    };
  });
}

/**
 * Build cleanup summary.
 */
export function buildCleanupSummary(records: CleanupRecord[]): CleanupSummary {
  let safeToHide = 0;
  let safeToAlias = 0;
  let safeToReplace = 0;
  let safeToDelete = 0;
  let notSafe = 0;
  let deprecated = 0;
  let hidden = 0;

  for (const r of records) {
    switch (r.safety) {
      case "SAFE_TO_HIDE": safeToHide++; break;
      case "SAFE_TO_ALIAS": safeToAlias++; break;
      case "SAFE_TO_REPLACE_IN_TEMPLATE": safeToReplace++; break;
      case "SAFE_TO_DELETE_LATER": safeToDelete++; break;
      case "NOT_SAFE": notSafe++; break;
    }
    if (r.deprecation.deprecated) deprecated++;
    if (isHidden(r.key)) hidden++;
  }

  return {
    total: records.length,
    safeToHide,
    safeToAlias,
    safeToReplace,
    safeToDelete,
    notSafe,
    deprecated,
    hidden,
  };
}
