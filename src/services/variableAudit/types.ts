/**
 * Types for the Variable Audit Engine
 */

export type AuditStatus =
  | "OK"
  | "FALTA_ORIGEM"
  | "FALTA_RESOLVER_FRONTEND"
  | "FALTA_RESOLVER_BACKEND"
  | "FALTA_CATALOGAR"
  | "ORFA"
  | "LEGADA"
  | "CONFLITANTE"
  | "NOT_IMPLEMENTED";

export type AuditAction =
  | "NENHUMA"
  | "CRIAR_NO_CATALOGO"
  | "CRIAR_ALIAS"
  | "CORRIGIR_SEMANTICA"
  | "CORRIGIR_ORIGEM"
  | "AMPLIAR_FRONTEND"
  | "AMPLIAR_BACKEND"
  | "MARCAR_COMO_LEGADA"
  | "DESATIVAR"
  | "IMPLEMENTAR";

export interface AuditRecord {
  key: string;
  label: string;
  group: string;
  description: string;
  is_legacy: boolean;
  not_implemented: boolean;
  exists_in_catalog: boolean;
  exists_in_frontend_resolver: boolean;
  exists_in_backend_flatten: boolean;
  exists_in_backend_template_preview: boolean;
  exists_in_template_docs: boolean;
  exists_in_real_sources: boolean;
  observed_in_real_snapshots: boolean;
  snapshot_observation_count: number;
  snapshot_sample_value?: string;
  canonical_source: string;
  source_path: string;
  legacy_aliases: string[];
  status: AuditStatus;
  recommended_action: AuditAction;
}

export interface AuditSummary {
  total: number;
  ok: number;
  orphaned: number;
  legacy: number;
  conflicting: number;
  missing_frontend: number;
  missing_backend: number;
  missing_origin: number;
  not_implemented: number;
  observed_in_snapshots: number;
  not_observed_in_snapshots: number;
}

export interface GroupSummary {
  group: string;
  group_label: string;
  total: number;
  ok: number;
  problems: number;
  completeness_pct: number;
  observed_pct: number;
}

export interface BacklogItem {
  key: string;
  label: string;
  group: string;
  status: AuditStatus;
  action: AuditAction;
  impact: string;
  priority: number;
}

export interface AuditResult {
  records: AuditRecord[];
  summary: AuditSummary;
  group_summaries: GroupSummary[];
  backlog: BacklogItem[];
  generated_at: string;
  snapshot_data_loaded: boolean;
}

export interface SnapshotObservation {
  found: boolean;
  count: number;
  sample_value?: string;
}
