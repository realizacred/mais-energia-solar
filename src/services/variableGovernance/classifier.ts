/**
 * Variable Governance Classifier
 * Centralized classification engine — SSOT for governance decisions.
 * Uses real evidence from knownKeys, catalog, and custom vars.
 */

import { FRONTEND_RESOLVER_KEYS, BACKEND_FLATTEN_KEYS } from "@/services/variableAudit/knownKeys";
import type { CatalogVariable, VariableCategory } from "@/lib/variablesCatalog";
import { isBuiltinVcKey } from "@/lib/variablesCatalog";
import { deriveDomain, deriveNature } from "@/lib/variablesCatalog";
import type {
  GovernanceClass,
  GovernanceRecord,
  GovernanceSuggestion,
  CleanupReadiness,
} from "./types";

// ── Known sets ──

/** Variables known to be legacy aliases */
const LEGACY_VARS = new Set(["capo_m"]);

/** Variables that are wizard input fields */
const WIZARD_INPUT_VARS = new Set(["capo_seguro", "capo_desconto", "capo_string_box"]);

/** Supplier/kit snapshot vars — resolved via snapshot passthrough when kit is selected */
const SUPPLIER_SNAPSHOT_VARS = new Set([
  "tipo_fornecedor_distribuidor", "fornecedor", "tipo_kit",
  "fabricante", "sku",
]);

/** Passthrough groups — resolved via snapshot deepGet, no explicit resolver needed */
const PASSTHROUGH_GROUPS = new Set(["series", "tabelas", "premissas"]);

/** Document-scope categories */
const DOCUMENT_CATEGORIES = new Set<string>(["contrato", "assinatura", "pagamento"]);

/** CDD category */
const CDD_CATEGORY = "cdd";

/** Known legacy → modern mappings */
const LEGACY_REPLACEMENTS: Record<string, string> = {
  capo_m: "modulo_garantia",
};

/** Patterns that indicate dynamic/indexed resolution */
const MONTHLY_SUFFIXES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function isDynamicKey(flatKey: string): boolean {
  // Monthly series
  if (MONTHLY_SUFFIXES.some(m => flatKey.endsWith(`_${m}`))) return true;
  // Annual series _0.._25
  const annualMatch = flatKey.match(/_(\d+)$/);
  if (annualMatch) {
    const n = parseInt(annualMatch[1]);
    if (n >= 0 && n <= 25 && !flatKey.includes("_uc")) return true;
  }
  // UC-indexed
  if (/_uc\d+$/.test(flatKey)) return true;
  // Equipment-indexed
  if (/_\d+$/.test(flatKey) && (
    flatKey.includes("inversor_") || flatKey.includes("bateria_") || flatKey.includes("kit_comp_")
  )) return true;
  return false;
}

function isInFE(flatKey: string, dottedKey: string): boolean {
  if (FRONTEND_RESOLVER_KEYS.has(dottedKey)) return true;
  // Check base pattern
  const base = dottedKey.replace(/_\d+$/, "_1");
  if (base !== dottedKey && FRONTEND_RESOLVER_KEYS.has(base)) return true;
  // Check UC base
  const ucBase = dottedKey.replace(/_uc\d+$/, "");
  if (ucBase !== dottedKey && FRONTEND_RESOLVER_KEYS.has(ucBase)) return true;
  return false;
}

function isInBE(flatKey: string): boolean {
  if (BACKEND_FLATTEN_KEYS.has(flatKey)) return true;
  // Base pattern
  const base = flatKey.replace(/_\d+$/, "_1");
  if (base !== flatKey && BACKEND_FLATTEN_KEYS.has(base)) return true;
  return false;
}

/**
 * Classify a single variable by real evidence.
 */
export function classifyGovernance(
  v: CatalogVariable,
  customVarKeys: Set<string>,
  dynamicFieldKeys: Set<string>,
): GovernanceRecord {
  const flatKey = v.legacyKey.replace(/^\[|\]$/g, "");
  const dottedKey = v.canonicalKey.replace(/^\{\{|\}\}$/g, "");
  const group = dottedKey.split(".")[0] as VariableCategory;

  const inFE = isInFE(flatKey, dottedKey);
  const inBE = isInBE(flatKey);
  const isCustom = customVarKeys.has(flatKey);
  const isBuiltinCustom = isBuiltinVcKey(flatKey);
  const isDynamic = isDynamicKey(flatKey);
  const isDocument = DOCUMENT_CATEGORIES.has(group);
  const isPassthrough = PASSTHROUGH_GROUPS.has(group);
  const isLegacy = LEGACY_VARS.has(flatKey);
  const isWizardInput = WIZARD_INPUT_VARS.has(flatKey);
  const isCdd = (group as string) === CDD_CATEGORY || !!v.notImplemented;
  const isDynamicField = dynamicFieldKeys.has(flatKey);
  const isSupplier = SUPPLIER_SNAPSHOT_VARS.has(flatKey);

  // ── Determine classification ──
  let classification: GovernanceClass;
  let evidence: string;

  if (isLegacy) {
    classification = "ALIAS_LEGADO";
    evidence = `Placeholder legado — substituir por [${LEGACY_REPLACEMENTS[flatKey] || "equivalente moderno"}]`;
  } else if (isDocument) {
    classification = "DOCUMENTO";
    evidence = `Variável de escopo documento/contrato (${group})`;
  } else if (isCdd && group === CDD_CATEGORY) {
    classification = "CDD";
    evidence = "Campos de distribuidores — feature não implementada";
  } else if (v.notImplemented && group !== CDD_CATEGORY) {
    classification = "FEATURE_NAO_IMPLEMENTADA";
    evidence = "Marcada como notImplemented no catálogo";
  } else if (isPassthrough) {
    classification = "PASSTHROUGH";
    evidence = `Grupo ${group} resolvido via snapshot deepGet (passthrough)`;
  } else if (isDynamic) {
    classification = inFE || inBE ? "IMPLEMENTADA" : "PASSTHROUGH";
    evidence = "Chave dinâmica (mensal/anual/UC/equipamento) resolvida via padrão iterativo";
  } else if (isCustom || isBuiltinCustom) {
    // Custom vars: either from DB (isCustom) or built-in catalog defaults (isBuiltinCustom)
    classification = inBE ? "CUSTOM_IMPL" : "CUSTOM_BACKEND";
    evidence = isBuiltinCustom
      ? "Variável customizada built-in — avaliada via evaluateExpression (default do catálogo)"
      : "Variável customizada do banco — avaliada via evaluateExpression";
  } else if (isWizardInput) {
    classification = "INPUT_WIZARD";
    evidence = "Input do wizard — persistido no snapshot";
  } else if (isSupplier) {
    classification = "PARCIAL_BE_ONLY";
    evidence = "Dado de fornecedor/kit — resolvido via snapshot quando kit é selecionado";
  } else if (isDynamicField) {
    classification = "IMPLEMENTADA";
    evidence = "Campo dinâmico (deal_custom_fields) — passthrough via snapshot";
  } else if (inFE && inBE) {
    classification = "IMPLEMENTADA";
    evidence = "Coberta em FE resolver e BE resolver";
  } else if (!inFE && inBE) {
    classification = "PARCIAL_BE_ONLY";
    evidence = "BE resolve via flatten/resolvers; FE usa fallback snapshot";
  } else if (inFE && !inBE) {
    classification = "PARCIAL_FE_ONLY";
    evidence = "Só FE resolve — técnica interna, não expor em visão de negócio";
  } else if (v.escopo === "aspiracional") {
    classification = "MAPEAVEL";
    evidence = "Variável aspiracional — dado pode existir mas não está integrado";
  } else {
    // Check if it's a _numero variant of something that exists
    if (flatKey.endsWith("_numero")) {
      const base = flatKey.replace(/_numero$/, "");
      if (BACKEND_FLATTEN_KEYS.has(base)) {
        classification = "PARCIAL_BE_ONLY";
        evidence = `Variante _numero de [${base}] — BE resolve a base`;
      } else {
        classification = "FANTASMA_REAL";
        evidence = "Sem resolver FE ou BE, sem dados identificados";
      }
    } else {
      classification = "FANTASMA_REAL";
      evidence = "Sem resolver FE ou BE, sem dados identificados";
    }
  }

  // ── Build suggestions ──
  const suggestions: GovernanceSuggestion[] = [];

  if (classification === "ALIAS_LEGADO" && LEGACY_REPLACEMENTS[flatKey]) {
    suggestions.push({
      type: "replace_template",
      message: `Substituir [${flatKey}] por [${LEGACY_REPLACEMENTS[flatKey]}] nos templates`,
      replacementKey: LEGACY_REPLACEMENTS[flatKey],
    });
  }

  if (classification === "PARCIAL_FE_ONLY") {
    suggestions.push({
      type: "add_resolver",
      message: "Adicionar resolver no backend (_shared/resolvers/) para paridade",
    });
  }

  if (classification === "FANTASMA_REAL") {
    suggestions.push({
      type: "future_feature",
      message: "Verificar se dado existe no snapshot ou se é feature futura",
    });
  }

  if (classification === "INPUT_WIZARD") {
    suggestions.push({
      type: "add_input",
      message: "Garantir que campo existe no wizard e persiste no snapshot",
    });
  }

  // ── Cleanup readiness ──
  const cleanup: CleanupReadiness = {
    segura_para_ocultar: classification === "FANTASMA_REAL" || classification === "ALIAS_LEGADO",
    segura_para_substituir_em_template: classification === "ALIAS_LEGADO" && !!LEGACY_REPLACEMENTS[flatKey],
    segura_para_alias: classification === "ALIAS_LEGADO",
    segura_para_limpeza_futura: classification === "FANTASMA_REAL",
  };

  // ── Template safety ──
  let templateWarning: "none" | "warn" | "block" = "none";
  let safeForNewTemplates = true;

  if (classification === "FANTASMA_REAL") {
    templateWarning = "block";
    safeForNewTemplates = false;
  } else if (classification === "ALIAS_LEGADO") {
    templateWarning = "warn";
    safeForNewTemplates = false;
  } else if (classification === "FEATURE_NAO_IMPLEMENTADA" || classification === "CDD") {
    templateWarning = "warn";
    safeForNewTemplates = false;
  } else if (classification === "PARCIAL_FE_ONLY" || classification === "MAPEAVEL") {
    templateWarning = "warn";
    safeForNewTemplates = false;
  }

  // ── UI status label + color ──
  const { statusLabel, statusColor } = getStatusDisplay(classification);

  return {
    key: flatKey,
    label: v.label,
    category: group,
    domain: deriveDomain(v),
    nature: deriveNature(v),
    classification,
    statusLabel,
    statusColor,
    evidence,
    safeForNewTemplates,
    templateWarning,
    cleanup,
    suggestions,
    inFE,
    inBE,
    isCustom,
    isDocument,
    isLegacy,
    isPassthrough,
  };
}

function getStatusDisplay(cls: GovernanceClass): { statusLabel: string; statusColor: GovernanceRecord["statusColor"] } {
  switch (cls) {
    case "IMPLEMENTADA": return { statusLabel: "Implementada", statusColor: "success" };
    case "PARCIAL_BE_ONLY": return { statusLabel: "Backend/Snapshot", statusColor: "info" };
    case "PARCIAL_FE_ONLY": return { statusLabel: "Técnica (só FE)", statusColor: "warning" };
    case "CUSTOM_BACKEND": return { statusLabel: "Custom (backend)", statusColor: "primary" };
    case "CUSTOM_IMPL": return { statusLabel: "Custom", statusColor: "primary" };
    case "INPUT_WIZARD": return { statusLabel: "Input Wizard", statusColor: "info" };
    case "ALIAS_LEGADO": return { statusLabel: "Legado", statusColor: "muted" };
    case "TEMPLATE_LEGADO": return { statusLabel: "Template Legado", statusColor: "muted" };
    case "FEATURE_NAO_IMPLEMENTADA": return { statusLabel: "Futura", statusColor: "secondary" };
    case "DOCUMENTO": return { statusLabel: "Documento", statusColor: "info" };
    case "CDD": return { statusLabel: "CDD (futuro)", statusColor: "secondary" };
    case "MAPEAVEL": return { statusLabel: "Mapeável", statusColor: "warning" };
    case "PASSTHROUGH": return { statusLabel: "Passthrough", statusColor: "info" };
    case "FANTASMA_REAL": return { statusLabel: "Fantasma", statusColor: "destructive" };
    default: return { statusLabel: "Desconhecida", statusColor: "muted" };
  }
}
