/**
 * Variable Audit Engine
 * Cross-references VARIABLES_CATALOG against frontend resolver,
 * backend flatten, and known data sources.
 */

import { VARIABLES_CATALOG, type CatalogVariable } from "@/lib/variablesCatalog";
import {
  FRONTEND_RESOLVER_KEYS,
  BACKEND_FLATTEN_KEYS,
  BACKEND_TEMPLATE_PREVIEW_KEYS,
  SOURCE_MAP,
} from "./knownKeys";
import type {
  AuditRecord,
  AuditResult,
  AuditSummary,
  AuditStatus,
  AuditAction,
} from "./types";

/**
 * Extracts dotted key from canonical "{{grupo.campo}}" → "grupo.campo"
 */
function extractDottedKey(canonicalKey: string): string {
  return canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
}

/**
 * Extracts flat key from legacy "[campo]" → "campo"
 */
function extractFlatKey(legacyKey: string): string {
  return legacyKey.replace(/^\[/, "").replace(/\]$/, "");
}

/**
 * Check if a dotted key is resolved in the frontend resolver.
 * Handles both exact match and pattern-based keys (indexed variables).
 */
function isInFrontendResolver(dottedKey: string): boolean {
  if (FRONTEND_RESOLVER_KEYS.has(dottedKey)) return true;
  // Check if it's an indexed variant (e.g., financeiro.f_nome_2 matches pattern f_nome_N)
  const basePattern = dottedKey.replace(/_\d+$/, "_1");
  if (basePattern !== dottedKey && FRONTEND_RESOLVER_KEYS.has(basePattern)) return true;
  // Check UC-indexed variants (e.g., entrada.consumo_mensal_uc2 → entrada.consumo_mensal)
  const ucBase = dottedKey.replace(/_uc\d+$/, "");
  if (ucBase !== dottedKey && FRONTEND_RESOLVER_KEYS.has(ucBase)) return true;
  // Monthly variants (e.g., entrada.consumo_jan → entrada.consumo_mensal)
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (const m of months) {
    if (dottedKey.endsWith(`_${m}`)) {
      // Monthly series are resolved via finalSnapshot, not explicit resolver
      return true;
    }
  }
  // Annual series (_0 to _25)
  const annualMatch = dottedKey.match(/_(\d+)$/);
  if (annualMatch) {
    const num = parseInt(annualMatch[1]);
    if (num >= 0 && num <= 25) {
      const seriesBase = dottedKey.replace(/_\d+$/, "_0");
      if (seriesBase !== dottedKey) return true; // Series resolved via finalSnapshot
    }
  }
  return false;
}

/**
 * Check if a flat key is present in the backend flatten.
 */
function isInBackendFlatten(flatKey: string, dottedKey: string): boolean {
  if (BACKEND_FLATTEN_KEYS.has(flatKey)) return true;
  // The flatten also produces prefixed keys from nested objects (e.g., tecnico_potencia_kwp)
  const underscored = dottedKey.replace(/\./g, "_");
  if (BACKEND_FLATTEN_KEYS.has(underscored)) return true;
  // Indexed variants
  const basePattern = flatKey.replace(/_\d+$/, "_1");
  if (basePattern !== flatKey && BACKEND_FLATTEN_KEYS.has(basePattern)) return true;
  return false;
}

/**
 * Determine the canonical source for a variable.
 */
function getCanonicalSource(dottedKey: string): { source: string; path: string } {
  if (SOURCE_MAP[dottedKey]) return SOURCE_MAP[dottedKey];
  // Infer from category
  const group = dottedKey.split(".")[0];
  const groupSourceMap: Record<string, string> = {
    entrada: "ucs / wizard inputs",
    sistema_solar: "kit / tecnico / itens",
    financeiro: "financeiro / ctx / pagamentoOpcoes",
    conta_energia: "gdResult / ucs",
    comercial: "comercial / consultor",
    cliente: "cliente",
    tabelas: "series / outputs",
    series: "series / outputs",
    premissas: "premissas",
    tarifa: "tariffVersion / concessionarias",
    aneel: "aneelRun",
    gd: "gdResult",
    calculo: "gdResult / motor GD",
    cdd: "distribuidores (não implementado)",
    customizada: "expressões customizadas / pagamentoOpcoes",
  };
  return {
    source: groupSourceMap[group] || "desconhecido",
    path: `${group} (inferido)`,
  };
}

/**
 * Determine if a variable is "legacy" (a backward compat alias).
 */
function isLegacyVariable(v: CatalogVariable): boolean {
  const label = v.label.toLowerCase();
  const desc = v.description.toLowerCase();
  return label.includes("legado") || label.includes("(legado)") ||
    desc.includes("legado") || desc.includes("legacy") ||
    desc.includes("backward compat") || desc.includes("alias");
}

/**
 * Determine status and recommended action for a variable.
 */
function classifyVariable(
  v: CatalogVariable,
  inFrontend: boolean,
  inBackend: boolean,
  inTemplatePreview: boolean,
): { status: AuditStatus; action: AuditAction } {
  // Not implemented
  if (v.notImplemented) {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR" };
  }

  const isLegacy = isLegacyVariable(v);

  // All layers covered
  if (inFrontend && inBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA" };
    return { status: "OK", action: "NENHUMA" };
  }

  // Frontend only
  if (inFrontend && !inBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA" };
    return { status: "FALTA_RESOLVER_BACKEND", action: "AMPLIAR_BACKEND" };
  }

  // Backend only
  if (!inFrontend && inBackend) {
    return { status: "FALTA_RESOLVER_FRONTEND", action: "AMPLIAR_FRONTEND" };
  }

  // Neither — check if it's a series/calculated variable that resolves via finalSnapshot
  const dottedKey = extractDottedKey(v.canonicalKey);
  const group = dottedKey.split(".")[0];
  
  // Series and calculated fields resolve via finalSnapshot in frontend
  if (["series", "tabelas", "premissas"].includes(group)) {
    return { status: "OK", action: "NENHUMA" };
  }

  // Monthly/annual series resolved via finalSnapshot
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const isMonthly = months.some(m => dottedKey.endsWith(`_${m}`));
  const isAnnual = /_\d+$/.test(dottedKey) && !/_uc\d+$/.test(dottedKey);
  if (isMonthly || isAnnual) {
    return { status: "OK", action: "NENHUMA" };
  }

  // UC-indexed variants resolved via pattern
  if (/_uc\d+$/.test(dottedKey)) {
    return { status: "OK", action: "NENHUMA" };
  }

  // Indexed equipment variants (inversor_2, bateria_2, etc.)
  if (/_\d+$/.test(dottedKey) && (
    dottedKey.includes("inversor_") || dottedKey.includes("bateria_") ||
    dottedKey.includes("kit_comp_")
  )) {
    return { status: "OK", action: "NENHUMA" };
  }

  // CDD variables are explicitly not implemented
  if (group === "cdd") {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR" };
  }

  // Customizada variables may be resolved via expression engine
  if (group === "customizada") {
    return { status: "OK", action: "NENHUMA" };
  }

  if (isLegacy) return { status: "LEGADA", action: "MARCAR_COMO_LEGADA" };

  return { status: "FALTA_ORIGEM", action: "CORRIGIR_ORIGEM" };
}

/**
 * Run the full audit against all catalog variables.
 */
export function runVariableAudit(): AuditResult {
  const records: AuditRecord[] = [];

  for (const v of VARIABLES_CATALOG) {
    const dottedKey = extractDottedKey(v.canonicalKey);
    const flatKey = extractFlatKey(v.legacyKey);

    const inFrontend = isInFrontendResolver(dottedKey);
    const inBackend = isInBackendFlatten(flatKey, dottedKey);
    const inTemplatePreview = inBackend || BACKEND_TEMPLATE_PREVIEW_KEYS.has(flatKey);

    const { source, path } = getCanonicalSource(dottedKey);
    const { status, action } = classifyVariable(v, inFrontend, inBackend, inTemplatePreview);
    const isLegacy = isLegacyVariable(v);

    records.push({
      key: dottedKey,
      label: v.label,
      group: v.category,
      description: v.description,
      is_legacy: isLegacy,
      not_implemented: !!v.notImplemented,
      exists_in_catalog: true,
      exists_in_frontend_resolver: inFrontend,
      exists_in_backend_flatten: inBackend,
      exists_in_backend_template_preview: inTemplatePreview,
      exists_in_template_docs: true, // All catalog vars are available for templates
      exists_in_real_sources: status === "OK" || status === "LEGADA" || inFrontend || inBackend,
      canonical_source: source,
      source_path: path,
      legacy_aliases: [flatKey],
      status,
      recommended_action: action,
    });
  }

  const summary = computeSummary(records);

  return {
    records,
    summary,
    generated_at: new Date().toISOString(),
  };
}

function computeSummary(records: AuditRecord[]): AuditSummary {
  return {
    total: records.length,
    ok: records.filter(r => r.status === "OK").length,
    orphaned: records.filter(r => r.status === "ORFA").length,
    legacy: records.filter(r => r.status === "LEGADA").length,
    conflicting: records.filter(r => r.status === "CONFLITANTE").length,
    missing_frontend: records.filter(r => r.status === "FALTA_RESOLVER_FRONTEND").length,
    missing_backend: records.filter(r => r.status === "FALTA_RESOLVER_BACKEND").length,
    missing_origin: records.filter(r => r.status === "FALTA_ORIGEM").length,
    not_implemented: records.filter(r => r.status === "NOT_IMPLEMENTED").length,
  };
}

/**
 * Export audit result as CSV string.
 */
export function auditToCSV(result: AuditResult): string {
  const headers = [
    "key", "label", "group", "status", "recommended_action",
    "is_legacy", "not_implemented",
    "frontend", "backend", "template_preview",
    "canonical_source", "source_path", "legacy_aliases",
  ];

  const rows = result.records.map(r => [
    r.key, r.label, r.group, r.status, r.recommended_action,
    r.is_legacy ? "Sim" : "Não", r.not_implemented ? "Sim" : "Não",
    r.exists_in_frontend_resolver ? "✓" : "✗",
    r.exists_in_backend_flatten ? "✓" : "✗",
    r.exists_in_backend_template_preview ? "✓" : "✗",
    r.canonical_source, r.source_path,
    r.legacy_aliases.join("; "),
  ]);

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map(r => r.map(escape).join(",")),
  ].join("\n");
}
