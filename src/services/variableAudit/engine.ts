/**
 * Variable Audit Engine — REAL source-code analysis
 * Parses actual source files via Vite ?raw imports to extract keys.
 * No hardcoded key sets — everything derived from real code.
 */

import {
  VARIABLES_CATALOG,
  CATEGORY_LABELS,
  type CatalogVariable,
  type VariableCategory,
} from "@/lib/variablesCatalog";
import {
  extractFrontendResolverKeys,
  isKeyInFrontendResolver,
  getFrontendResolverAnalysis,
} from "./frontendResolverAnalyzer";
import {
  extractBackendFlattenKeys,
  isKeyInBackendFlatten,
  getBackendFlattenAnalysis,
} from "./backendFlattenAnalyzer";
import {
  extractTemplatePreviewKeys,
  isKeyInTemplatePreview,
  getTemplatePreviewAnalysis,
} from "./templatePreviewAnalyzer";
import { classifyVariable, isLegacyVariable } from "./statusClassifier";
import { SOURCE_MAP } from "./knownKeys";
import type {
  AuditRecord,
  AuditResult,
  AuditSummary,
  AuditStatus,
  AuditAction,
  GroupSummary,
  BacklogItem,
  AnalysisMetadata,
  SnapshotObservation,
} from "./types";

function extractDottedKey(canonicalKey: string): string {
  return canonicalKey.replace(/^\{\{/, "").replace(/\}\}$/, "");
}

function extractFlatKey(legacyKey: string): string {
  return legacyKey.replace(/^\[/, "").replace(/\]$/, "");
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

/**
 * Run the full audit using REAL source-code analysis.
 */
export function runVariableAudit(
  snapshotData?: Record<string, SnapshotObservation>
): AuditResult {
  // ── Step 1: Extract keys from REAL source files ──
  const frontendKeys = extractFrontendResolverKeys();
  const flattenKeys = extractBackendFlattenKeys();
  const previewKeys = extractTemplatePreviewKeys();

  // Get analysis metadata
  const feAnalysis = getFrontendResolverAnalysis();
  const beAnalysis = getBackendFlattenAnalysis();
  const tpAnalysis = getTemplatePreviewAnalysis();

  const hasSnapshotData = !!snapshotData && Object.keys(snapshotData).length > 0;

  // ── Step 2: Audit each catalog variable ──
  const records: AuditRecord[] = [];

  for (const v of VARIABLES_CATALOG) {
    const dottedKey = extractDottedKey(v.canonicalKey);
    const flatKey = extractFlatKey(v.legacyKey);

    const inFrontend = isKeyInFrontendResolver(dottedKey, frontendKeys);
    const inBackend = isKeyInBackendFlatten(flatKey, dottedKey, flattenKeys);
    const inPreview = isKeyInTemplatePreview(flatKey, previewKeys);

    const { source, path } = getCanonicalSource(dottedKey);
    const { status, action, evidence } = classifyVariable({
      variable: v,
      inFrontendResolver: inFrontend,
      inBackendFlatten: inBackend,
      inTemplatePreview: inPreview,
      templatePreviewHasDynamicPassthrough: tpAnalysis.hasDynamicSnapshotPassthrough,
      frontendHasFinalSnapshotFallback: feAnalysis.hasFinalSnapshotFallback,
    });

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
      exists_in_backend_template_preview: inPreview,
      exists_in_template_docs: true, // Template-preview has dynamic passthrough for all snapshot keys
      exists_in_real_sources: status === "OK" || status === "LEGADA" || inFrontend || inBackend || inPreview,
      observed_in_real_snapshots: snapObs?.found ?? false,
      snapshot_observation_count: snapObs?.count ?? 0,
      snapshot_sample_value: snapObs?.sample_value,
      canonical_source: source,
      source_path: path,
      legacy_aliases: [flatKey],
      status,
      recommended_action: action,
      evidence,
    });
  }

  const summary = computeSummary(records);
  const group_summaries = computeGroupSummaries(records);
  const backlog = computeBacklog(records);

  const analysis_metadata: AnalysisMetadata = {
    frontend_resolver: {
      total_explicit_keys: feAnalysis.totalExplicitKeys,
      source_lines: feAnalysis.sourceLines,
      has_final_snapshot_fallback: feAnalysis.hasFinalSnapshotFallback,
    },
    backend_flatten: {
      total_explicit_keys: beAnalysis.totalExplicitKeys,
      source_lines: beAnalysis.sourceLines,
      has_dynamic_key_generation: beAnalysis.hasDynamicKeyGeneration,
    },
    template_preview: {
      total_explicit_keys: tpAnalysis.totalExplicitKeys,
      source_lines: tpAnalysis.sourceLines,
      uses_flattener: tpAnalysis.usesFlattener,
      has_dynamic_snapshot_passthrough: tpAnalysis.hasDynamicSnapshotPassthrough,
    },
  };

  return {
    records,
    summary,
    group_summaries,
    backlog,
    analysis_metadata,
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
    "key", "label", "group", "status", "recommended_action", "evidence",
    "is_legacy", "not_implemented",
    "frontend_resolver", "backend_flatten", "template_preview",
    "observed_in_snapshots", "snapshot_count",
    "canonical_source", "source_path", "legacy_aliases",
  ];

  const rows = result.records.map(r => [
    r.key, r.label, r.group, r.status, r.recommended_action, r.evidence,
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
