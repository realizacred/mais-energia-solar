/**
 * Status Classifier
 * Classifies each variable based on REAL evidence from all analyzed layers.
 */

import type { CatalogVariable } from "@/lib/variablesCatalog";
import type { AuditStatus, AuditAction } from "./types";

export interface ClassificationInput {
  variable: CatalogVariable;
  inFrontendResolver: boolean;
  inBackendFlatten: boolean;
  inTemplatePreview: boolean;
  /** Whether template-preview has dynamic snapshot passthrough (accepts any snapshot key) */
  templatePreviewHasDynamicPassthrough: boolean;
  /** Whether the frontend resolver uses finalSnapshot as universal fallback (deepGet) */
  frontendHasFinalSnapshotFallback: boolean;
}

/**
 * Determine if a variable is "legacy" based on its label/description.
 */
export function isLegacyVariable(v: CatalogVariable): boolean {
  const label = v.label.toLowerCase();
  const desc = v.description.toLowerCase();
  return (
    label.includes("legado") ||
    label.includes("(legado)") ||
    desc.includes("legado") ||
    desc.includes("legacy") ||
    desc.includes("backward compat") ||
    desc.includes("alias")
  );
}

/**
 * Classify a variable based on real evidence from all layers.
 */
export function classifyVariable(input: ClassificationInput): {
  status: AuditStatus;
  action: AuditAction;
  evidence: string;
} {
  const { variable: v, inFrontendResolver, inBackendFlatten, inTemplatePreview, templatePreviewHasDynamicPassthrough, frontendHasFinalSnapshotFallback } = input;

  // Not implemented
  if (v.notImplemented) {
    return {
      status: "NOT_IMPLEMENTED",
      action: "IMPLEMENTAR",
      evidence: "Marcada como notImplemented no catálogo",
    };
  }

  const isLegacy = isLegacyVariable(v);
  const dottedKey = v.canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const group = dottedKey.split(".")[0];

  // Backend coverage: explicit in flatten OR explicit in template-preview
  // Dynamic passthrough means template-preview will pass through any snapshot key
  const effectiveBackend = inBackendFlatten || inTemplatePreview || templatePreviewHasDynamicPassthrough;

  // Frontend coverage: explicit in resolver manifest OR via finalSnapshot fallback (deepGet)
  // When finalSnapshot fallback exists, the frontend resolves ANY key present in the snapshot
  const effectiveFrontend = inFrontendResolver || frontendHasFinalSnapshotFallback;

  // All layers covered
  if (effectiveFrontend && effectiveBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: "Legada com cobertura em FE+BE" };
    if (inFrontendResolver) return { status: "OK", action: "NENHUMA", evidence: "Coberta em frontend resolver e backend flatten/preview" };
    return { status: "OK", action: "NENHUMA", evidence: "Coberta via finalSnapshot fallback (FE) + backend flatten/preview" };
  }

  // Frontend only
  if (inFrontendResolver && !effectiveBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: "Legada, presente apenas no FE" };
    return { status: "FALTA_RESOLVER_BACKEND", action: "AMPLIAR_BACKEND", evidence: "Resolvida no frontend mas não encontrada no backend flatten/preview" };
  }

  // Backend only
  if (!inFrontendResolver && effectiveBackend) {
    return { status: "FALTA_RESOLVER_FRONTEND", action: "AMPLIAR_FRONTEND", evidence: "Presente no backend mas sem handler explícito no frontend resolver" };
  }

  // Neither — check special cases

  // Series, tables, premissas resolve via finalSnapshot in frontend
  if (["series", "tabelas", "premissas"].includes(group)) {
    return { status: "OK", action: "NENHUMA", evidence: "Grupo resolvido via finalSnapshot (deepGet)" };
  }

  // Monthly/annual series resolved via finalSnapshot
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const isMonthly = months.some(m => dottedKey.endsWith(`_${m}`));
  const isAnnual = /_\d+$/.test(dottedKey) && !/_uc\d+$/.test(dottedKey);
  if (isMonthly || isAnnual) {
    return { status: "OK", action: "NENHUMA", evidence: "Série mensal/anual resolvida via finalSnapshot" };
  }

  // UC-indexed variants
  if (/_uc\d+$/.test(dottedKey)) {
    return { status: "OK", action: "NENHUMA", evidence: "Variante UC-indexada resolvida via padrão" };
  }

  // Indexed equipment variants
  if (/_\d+$/.test(dottedKey) && (
    dottedKey.includes("inversor_") || dottedKey.includes("bateria_") ||
    dottedKey.includes("kit_comp_")
  )) {
    return { status: "OK", action: "NENHUMA", evidence: "Equipamento indexado resolvido via loop" };
  }

  // CDD variables are explicitly not implemented
  if (group === "cdd") {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR", evidence: "Grupo CDD não implementado" };
  }

  // Customizada variables may be resolved via expression engine
  if (group === "customizada") {
    return { status: "OK", action: "NENHUMA", evidence: "Resolvida via motor de expressões customizadas" };
  }

  if (isLegacy) {
    return { status: "LEGADA", action: "MARCAR_COMO_LEGADA", evidence: "Legada sem cobertura explícita em FE ou BE" };
  }

  return { status: "FALTA_ORIGEM", action: "CORRIGIR_ORIGEM", evidence: "Sem handler no FE, sem key no BE flatten/preview, sem padrão reconhecido" };
}
