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
  const { variable: v, inFrontendResolver, inBackendFlatten, inTemplatePreview } = input;

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

  // ── Groups that resolve entirely via passthrough (snapshot deepGet) ──
  // These groups don't need explicit resolvers — they're dynamic by nature
  const passthroughGroups = ["series", "tabelas", "premissas", "customizada"];
  if (passthroughGroups.includes(group)) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: `Grupo ${group} resolvido via passthrough (deepGet)` };
    return { status: "OK", action: "NENHUMA", evidence: `Grupo ${group} resolvido via passthrough (deepGet)` };
  }

  // ── Pattern-based resolution (monthly, annual, UC-indexed, equipment-indexed) ──
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const isMonthly = months.some(m => dottedKey.endsWith(`_${m}`));
  if (isMonthly) {
    return { status: "OK", action: "NENHUMA", evidence: "Série mensal resolvida via padrão iterativo" };
  }

  // Annual series (_0 to _25) but NOT UC-indexed
  const isAnnual = /_\d+$/.test(dottedKey) && !/_uc\d+$/.test(dottedKey);
  if (isAnnual) {
    const match = dottedKey.match(/_(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num >= 0 && num <= 25) {
        return { status: "OK", action: "NENHUMA", evidence: "Série anual resolvida via padrão iterativo" };
      }
    }
  }

  // UC-indexed variants (_uc1, _uc2, etc.)
  if (/_uc\d+$/.test(dottedKey)) {
    return { status: "OK", action: "NENHUMA", evidence: "Variante UC-indexada resolvida via padrão" };
  }

  // Indexed equipment variants (inversor_*_1, bateria_*_1, kit_comp_*_1)
  if (/_\d+$/.test(dottedKey) && (
    dottedKey.includes("inversor_") || dottedKey.includes("bateria_") ||
    dottedKey.includes("kit_comp_")
  )) {
    return { status: "OK", action: "NENHUMA", evidence: "Equipamento indexado resolvido via loop" };
  }

  // ── Real evidence-based classification ──
  // Backend: explicit in flatten OR in template-preview
  const hasBackend = inBackendFlatten || inTemplatePreview;
  // Frontend: explicit in resolver manifest
  const hasFrontend = inFrontendResolver;

  // Both layers covered
  if (hasFrontend && hasBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: "Legada com cobertura em FE+BE" };
    return { status: "OK", action: "NENHUMA", evidence: "Coberta em frontend resolver e backend flatten/preview" };
  }

  // Frontend only
  if (hasFrontend && !hasBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: "Legada, presente apenas no FE" };
    return { status: "FALTA_RESOLVER_BACKEND", action: "AMPLIAR_BACKEND", evidence: "Resolvida no frontend mas não encontrada no backend flatten/preview" };
  }

  // Backend only — still resolves via finalSnapshot fallback in FE, but flagging
  if (!hasFrontend && hasBackend) {
    // These ARE resolved at runtime via deepGet fallback — mark as OK but note no explicit FE handler
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA", evidence: "Legada, presente no BE, resolvida via fallback FE" };
    return { status: "OK", action: "NENHUMA", evidence: "Presente no backend, resolvida via finalSnapshot fallback no FE" };
  }

  // ── Neither explicit FE nor explicit BE ──

  // CDD group is explicitly not implemented
  if (group === "cdd") {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR", evidence: "Grupo CDD não implementado" };
  }

  if (isLegacy) {
    return { status: "LEGADA", action: "MARCAR_COMO_LEGADA", evidence: "Legada sem cobertura explícita em FE ou BE" };
  }

  return { status: "FALTA_ORIGEM", action: "CORRIGIR_ORIGEM", evidence: "Sem resolver explícito no FE nem chave no BE flatten — variável no catálogo mas sem dados reais" };
}
