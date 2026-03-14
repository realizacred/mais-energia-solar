/**
 * Variable Audit Engine
 * Cross-references VARIABLES_CATALOG against frontend resolver,
 * backend flatten, and known data sources.
 */

import { VARIABLES_CATALOG, CATEGORY_LABELS, type CatalogVariable, type VariableCategory } from "@/lib/variablesCatalog";
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
  GroupSummary,
  BacklogItem,
  SnapshotObservation,
} from "./types";

function extractDottedKey(canonicalKey: string): string {
  return canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
}

function extractFlatKey(legacyKey: string): string {
  return legacyKey.replace(/^\[/, "").replace(/\]$/, "");
}

function isInFrontendResolver(dottedKey: string): boolean {
  if (FRONTEND_RESOLVER_KEYS.has(dottedKey)) return true;
  const basePattern = dottedKey.replace(/_\d+$/, "_1");
  if (basePattern !== dottedKey && FRONTEND_RESOLVER_KEYS.has(basePattern)) return true;
  const ucBase = dottedKey.replace(/_uc\d+$/, "");
  if (ucBase !== dottedKey && FRONTEND_RESOLVER_KEYS.has(ucBase)) return true;
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  for (const m of months) {
    if (dottedKey.endsWith(`_${m}`)) return true;
  }
  const annualMatch = dottedKey.match(/_(\d+)$/);
  if (annualMatch) {
    const num = parseInt(annualMatch[1]);
    if (num >= 0 && num <= 25) {
      const seriesBase = dottedKey.replace(/_\d+$/, "_0");
      if (seriesBase !== dottedKey) return true;
    }
  }
  return false;
}

function isInBackendFlatten(flatKey: string, dottedKey: string): boolean {
  if (BACKEND_FLATTEN_KEYS.has(flatKey)) return true;
  const underscored = dottedKey.replace(/\./g, "_");
  if (BACKEND_FLATTEN_KEYS.has(underscored)) return true;
  const basePattern = flatKey.replace(/_\d+$/, "_1");
  if (basePattern !== flatKey && BACKEND_FLATTEN_KEYS.has(basePattern)) return true;
  return false;
}

function getCanonicalSource(dottedKey: string): { source: string; path: string } {
  if (SOURCE_MAP[dottedKey]) return SOURCE_MAP[dottedKey];
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

function isLegacyVariable(v: CatalogVariable): boolean {
  const label = v.label.toLowerCase();
  const desc = v.description.toLowerCase();
  return label.includes("legado") || label.includes("(legado)") ||
    desc.includes("legado") || desc.includes("legacy") ||
    desc.includes("backward compat") || desc.includes("alias");
}

function classifyVariable(
  v: CatalogVariable,
  inFrontend: boolean,
  inBackend: boolean,
  _inTemplatePreview: boolean,
): { status: AuditStatus; action: AuditAction } {
  if (v.notImplemented) {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR" };
  }

  const isLegacy = isLegacyVariable(v);

  if (inFrontend && inBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA" };
    return { status: "OK", action: "NENHUMA" };
  }

  if (inFrontend && !inBackend) {
    if (isLegacy) return { status: "LEGADA", action: "NENHUMA" };
    return { status: "FALTA_RESOLVER_BACKEND", action: "AMPLIAR_BACKEND" };
  }

  if (!inFrontend && inBackend) {
    return { status: "FALTA_RESOLVER_FRONTEND", action: "AMPLIAR_FRONTEND" };
  }

  const dottedKey = extractDottedKey(v.canonicalKey);
  const group = dottedKey.split(".")[0];

  if (["series", "tabelas", "premissas"].includes(group)) {
    return { status: "OK", action: "NENHUMA" };
  }

  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const isMonthly = months.some(m => dottedKey.endsWith(`_${m}`));
  const isAnnual = /_\d+$/.test(dottedKey) && !/_uc\d+$/.test(dottedKey);
  if (isMonthly || isAnnual) {
    return { status: "OK", action: "NENHUMA" };
  }

  if (/_uc\d+$/.test(dottedKey)) {
    return { status: "OK", action: "NENHUMA" };
  }

  if (/_\d+$/.test(dottedKey) && (
    dottedKey.includes("inversor_") || dottedKey.includes("bateria_") ||
    dottedKey.includes("kit_comp_")
  )) {
    return { status: "OK", action: "NENHUMA" };
  }

  if (group === "cdd") {
    return { status: "NOT_IMPLEMENTED", action: "IMPLEMENTAR" };
  }

  if (group === "customizada") {
    return { status: "OK", action: "NENHUMA" };
  }

  if (isLegacy) return { status: "LEGADA", action: "MARCAR_COMO_LEGADA" };

  return { status: "FALTA_ORIGEM", action: "CORRIGIR_ORIGEM" };
}

/**
 * Run the full audit against all catalog variables.
 * Optionally merge snapshot observation data.
 */
export function runVariableAudit(
  snapshotData?: Record<string, SnapshotObservation>
): AuditResult {
  const records: AuditRecord[] = [];
  const hasSnapshotData = !!snapshotData && Object.keys(snapshotData).length > 0;

  for (const v of VARIABLES_CATALOG) {
    const dottedKey = extractDottedKey(v.canonicalKey);
    const flatKey = extractFlatKey(v.legacyKey);

    const inFrontend = isInFrontendResolver(dottedKey);
    const inBackend = isInBackendFlatten(flatKey, dottedKey);
    const inTemplatePreview = inBackend || BACKEND_TEMPLATE_PREVIEW_KEYS.has(flatKey);

    const { source, path } = getCanonicalSource(dottedKey);
    const { status, action } = classifyVariable(v, inFrontend, inBackend, inTemplatePreview);
    const isLegacy = isLegacyVariable(v);

    const snapObs = snapshotData?.[dottedKey];

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
      exists_in_template_docs: true,
      exists_in_real_sources: status === "OK" || status === "LEGADA" || inFrontend || inBackend,
      observed_in_real_snapshots: snapObs?.found ?? false,
      snapshot_observation_count: snapObs?.count ?? 0,
      snapshot_sample_value: snapObs?.sample_value,
      canonical_source: source,
      source_path: path,
      legacy_aliases: [flatKey],
      status,
      recommended_action: action,
    });
  }

  const summary = computeSummary(records);
  const group_summaries = computeGroupSummaries(records);
  const backlog = computeBacklog(records);

  return {
    records,
    summary,
    group_summaries,
    backlog,
    generated_at: new Date().toISOString(),
    snapshot_data_loaded: hasSnapshotData,
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
    observed_in_snapshots: records.filter(r => r.observed_in_real_snapshots).length,
    not_observed_in_snapshots: records.filter(r => !r.observed_in_real_snapshots).length,
  };
}

function computeGroupSummaries(records: AuditRecord[]): GroupSummary[] {
  const groups = new Map<string, AuditRecord[]>();
  for (const r of records) {
    const arr = groups.get(r.group) || [];
    arr.push(r);
    groups.set(r.group, arr);
  }

  return Array.from(groups.entries()).map(([group, recs]) => {
    const ok = recs.filter(r => r.status === "OK" || r.status === "LEGADA").length;
    const observed = recs.filter(r => r.observed_in_real_snapshots).length;
    return {
      group,
      group_label: CATEGORY_LABELS[group as VariableCategory] || group,
      total: recs.length,
      ok,
      problems: recs.length - ok - recs.filter(r => r.status === "NOT_IMPLEMENTED").length,
      completeness_pct: Math.round((ok / recs.length) * 100),
      observed_pct: Math.round((observed / recs.length) * 100),
    };
  });
}

function computeBacklog(records: AuditRecord[]): BacklogItem[] {
  const IMPACT_MAP: Record<AuditStatus, { impact: string; priority: number }> = {
    FALTA_ORIGEM: { impact: "Variável sem origem de dados — proposta não preencherá", priority: 1 },
    FALTA_RESOLVER_FRONTEND: { impact: "Preview de proposta não mostrará valor", priority: 2 },
    FALTA_RESOLVER_BACKEND: { impact: "DOCX gerado terá placeholder vazio", priority: 3 },
    CONFLITANTE: { impact: "Valor pode ser inconsistente entre camadas", priority: 4 },
    ORFA: { impact: "Variável no template sem correspondência no catálogo", priority: 5 },
    NOT_IMPLEMENTED: { impact: "Funcionalidade planejada mas não implementada", priority: 6 },
    FALTA_CATALOGAR: { impact: "Variável sem documentação", priority: 7 },
    OK: { impact: "", priority: 99 },
    LEGADA: { impact: "", priority: 99 },
  };

  return records
    .filter(r => r.status !== "OK" && r.status !== "LEGADA")
    .map(r => ({
      key: r.key,
      label: r.label,
      group: r.group,
      status: r.status,
      action: r.recommended_action,
      impact: IMPACT_MAP[r.status]?.impact || "",
      priority: IMPACT_MAP[r.status]?.priority || 99,
    }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 20);
}

/**
 * Export audit result as CSV string.
 */
export function auditToCSV(result: AuditResult): string {
  const headers = [
    "key", "label", "group", "status", "recommended_action",
    "is_legacy", "not_implemented",
    "frontend", "backend", "template_preview",
    "observed_in_snapshots", "snapshot_count",
    "canonical_source", "source_path", "legacy_aliases",
  ];

  const rows = result.records.map(r => [
    r.key, r.label, r.group, r.status, r.recommended_action,
    r.is_legacy ? "Sim" : "Não", r.not_implemented ? "Sim" : "Não",
    r.exists_in_frontend_resolver ? "✓" : "✗",
    r.exists_in_backend_flatten ? "✓" : "✗",
    r.exists_in_backend_template_preview ? "✓" : "✗",
    r.observed_in_real_snapshots ? "✓" : "✗",
    String(r.snapshot_observation_count),
    r.canonical_source, r.source_path,
    r.legacy_aliases.join("; "),
  ]);

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(","),
    ...rows.map(r => r.map(escape).join(",")),
  ].join("\n");
}
