// sm-promote: Motor canônico de promoção staging SolarMarket → CRM
// v2026-04-23.2 — usa .range() para superar PostgREST default cap de 1000 linhas
// PR 3: pipeline real (cliente → projeto → proposta → versão) com normalizadores
// e snapshot canônico mínimo compatível com flattenSnapshot.
//
// Governança:
// - RB-57: sem `let` no escopo de módulo. Estado por request via createInitialState().
// - RB-58: UPDATEs críticos validam afetação com .select().
// - RB-23: sem console.log ativo (apenas console.error com prefixo do módulo).
// - DA-40: sem hardcode de pipeline/consultor — resolução por DB ou metadata.
// - SSOT idempotência: external_entity_links (source=solarmarket).
// - Apenas grava em domínio canônico via service-role; tenant_id sempre explícito.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODULE = "sm-promote";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SM_MIGRATE_CHUNK_URL = `${SUPABASE_URL}/functions/v1/sm-migrate-chunk`;

const SOURCE = "solarmarket";
const LEGACY_SM_SOURCES = [SOURCE, "solar_market"] as const;
const DEFAULT_BATCH_LIMIT = 5;
const MAX_BATCH_LIMIT = 50;
const SUBJOB_HEARTBEAT_EVERY = 1;

type CanonicalEntity = "cliente" | "projeto" | "proposta" | "versao";
type Severity = "info" | "warning" | "error";
type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

type PromotionLogStatus = "ok" | "skipped" | "warning" | "error";

interface PendingLog {
  job_id: string;
  tenant_id: string;
  severity: Severity;
  step: string;
  status: PromotionLogStatus;
  message: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  canonical_entity_type: CanonicalEntity | null;
  canonical_entity_id: string | null;
  error_code: string | null;
  error_origin: string | null;
  details: Record<string, unknown>;
}

interface RequestState {
  startedAt: number;
  jobId: string | null;
  tenantId: string | null;
  userId: string | null;
  promotedProjectExternalIds: string[];
  counters: {
    promoted: number;
    skipped: number;
    blocked: number;
    warnings: number;
    errors: number;
    processed: number;
  };
  // Buffer de logs (bulk insert no fim do request) — RB-58 mantido com flush em error.
  logBuffer: PendingLog[];
}

function normalizePromotionLogStatus(status: string, severity: Severity): PromotionLogStatus {
  if (status === "ok" || status === "skipped" || status === "warning" || status === "error") {
    return status;
  }
  if (status === "blocked") return "error";
  if (status === "cancelled") return "warning";
  return severity === "info" ? "ok" : severity;
}

function createInitialState(): RequestState {
  return {
    startedAt: Date.now(),
    jobId: null,
    tenantId: null,
    userId: null,
      promotedProjectExternalIds: [],
    counters: { promoted: 0, skipped: 0, blocked: 0, warnings: 0, errors: 0, processed: 0 },
    logBuffer: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function delegateManualPromoteToChunked(authHeader: string): Promise<Response> {
  const res = await fetch(SM_MIGRATE_CHUNK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action: "start", payload: {} }),
  });

  const rawText = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { ok: false, error: rawText || `Falha ao iniciar ${SM_MIGRATE_CHUNK_URL}` };
  }

  if (!res.ok) {
    return jsonResponse({
      ok: false,
      error: typeof parsed.error === "string" ? parsed.error : `HTTP ${res.status}`,
      existing_job_id: parsed.existing_job_id ?? null,
    });
  }

  return jsonResponse({
    ...parsed,
    ok: true,
    job_id: parsed.master_job_id ?? null,
    status: "running",
    delegated_to: "sm-migrate-chunk",
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function resolveUserContext(
  authHeader: string | null,
  internalCallHeader?: string | null,
  internalTenantId?: string | null,
) {
  if (!authHeader) return null;

  // Bypass para chamadas internas (sm-migrate-chunk em modo cron_resume).
  // Aceita se: header especial + Authorization com service role key + tenant_id explícito.
  if (
    internalCallHeader === "sm-migrate-chunk-v1" &&
    authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` &&
    internalTenantId
  ) {
    return {
      userId: null as string | null,
      tenantId: internalTenantId,
    };
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: u, error: ue } = await userClient.auth.getUser();
  if (ue || !u?.user) return null;
  const { data: tenantId, error: te } = await userClient.rpc("get_user_tenant_id");
  if (te || !tenantId) return null;
  return { userId: u.user.id, tenantId: tenantId as string };
}

// ─── Jobs / logs ─────────────────────────────────────────────────────────────
async function createJob(
  admin: SupabaseClient,
  tenantId: string,
  userId: string | null,
  jobType: string,
  filters: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .insert({
      tenant_id: tenantId,
      triggered_by: userId ?? null,
      trigger_source: userId ? "manual" : "api",
      job_type: jobType,
      status: "pending" satisfies JobStatus,
      filters,
      metadata: {},
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(`Falha ao criar job: ${error?.message ?? "sem id"}`);
  }
  return data.id as string;
}

async function patchJob(
  admin: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .update(patch).eq("id", jobId).select("id");
  if (error) throw new Error(`patchJob ${jobId}: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(`patchJob ${jobId}: 0 linhas afetadas`);
  }
}

async function logEvent(
  admin: SupabaseClient,
  p: {
    jobId: string;
    tenantId: string;
    severity: Severity;
    step: string;
    status: string;
    message: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    canonicalEntityType?: CanonicalEntity | null;
    canonicalEntityId?: string | null;
    errorCode?: string | null;
    errorOrigin?: string | null;
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  const normalizedStatus = normalizePromotionLogStatus(p.status, p.severity);
  const normalizedSourceEntityId = p.sourceEntityId ?? p.canonicalEntityId ?? p.jobId;
  const { error } = await admin.from("solarmarket_promotion_logs").insert({
    job_id: p.jobId,
    tenant_id: p.tenantId,
    severity: p.severity,
    step: p.step,
    status: normalizedStatus,
    message: p.message,
    source_entity_type: p.sourceEntityType ?? null,
    source_entity_id: normalizedSourceEntityId,
    canonical_entity_type: p.canonicalEntityType ?? null,
    canonical_entity_id: p.canonicalEntityId ?? null,
    error_code: p.errorCode ?? null,
    error_origin: p.errorOrigin ?? null,
    details: {
      raw_status: p.status,
      ...(p.details ?? {}),
    },
  });
  if (error) console.error(`[${MODULE}] log fail:`, error.message);
}

/**
 * logEventBuffered — variante usada no hot path de promoção (loop por proposta).
 * Acumula logs no state.logBuffer; flushLogs() faz bulk insert no fim do request.
 * Logs com severity=error/warning são gravados imediatamente para preservar
 * rastreabilidade em caso de timeout/crash do request.
 */
function logEventBuffered(
  state: RequestState,
  admin: SupabaseClient,
  p: {
    jobId: string;
    tenantId: string;
    severity: Severity;
    step: string;
    status: string;
    message: string;
    sourceEntityType?: string | null;
    sourceEntityId?: string | null;
    canonicalEntityType?: CanonicalEntity | null;
    canonicalEntityId?: string | null;
    errorCode?: string | null;
    errorOrigin?: string | null;
    details?: Record<string, unknown> | null;
  },
): void {
  const normalizedStatus = normalizePromotionLogStatus(p.status, p.severity);
  const normalizedSourceEntityId = p.sourceEntityId ?? p.canonicalEntityId ?? p.jobId;
  const row: PendingLog = {
    job_id: p.jobId,
    tenant_id: p.tenantId,
    severity: p.severity,
    step: p.step,
    status: normalizedStatus,
    message: p.message,
    source_entity_type: p.sourceEntityType ?? null,
    source_entity_id: normalizedSourceEntityId,
    canonical_entity_type: p.canonicalEntityType ?? null,
    canonical_entity_id: p.canonicalEntityId ?? null,
    error_code: p.errorCode ?? null,
    error_origin: p.errorOrigin ?? null,
    details: { raw_status: p.status, ...(p.details ?? {}) },
  };
  state.logBuffer.push(row);

  // Flush eager se buffer crescer ou se for crítico — fire-and-forget
  // (não bloqueia o loop; falha de log nunca aborta migração).
  if (p.severity === "error" || state.logBuffer.length >= 100) {
    void flushLogs(state, admin);
  }
}

/**
 * flushLogs — grava todos os logs pendentes em uma única chamada bulk.
 * Resiliente: erro de log apenas registra no console, nunca falha o request.
 */
async function flushLogs(state: RequestState, admin: SupabaseClient): Promise<void> {
  if (state.logBuffer.length === 0) return;
  const batch = state.logBuffer.splice(0, state.logBuffer.length);
  const { error } = await admin.from("solarmarket_promotion_logs").insert(batch);
  if (error) {
    console.error(`[${MODULE}] flushLogs fail (${batch.length} rows):`, error.message);
    // re-enfileira para tentar de novo no próximo flush
    state.logBuffer.unshift(...batch);
  }
}

// ─── Idempotência: external_entity_links (SSOT) ──────────────────────────────
function canonicalTableForEntity(entityType: CanonicalEntity): "clientes" | "projetos" | "propostas_nativas" | "proposta_versoes" {
  switch (entityType) {
    case "cliente":
      return "clientes";
    case "projeto":
      return "projetos";
    case "proposta":
      return "propostas_nativas";
    case "versao":
      return "proposta_versoes";
  }
}

async function canonicalEntityExists(
  admin: SupabaseClient,
  tenantId: string,
  entityType: CanonicalEntity,
  entityId: string,
): Promise<boolean> {
  const table = canonicalTableForEntity(entityType);
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", entityId)
    .maybeSingle();
  if (error) throw new Error(`canonicalEntityExists(${entityType}): ${error.message}`);
  return !!data?.id;
}

async function cleanupOrphanLinks(admin: SupabaseClient, linkIds: string[]): Promise<void> {
  if (linkIds.length === 0) return;
  const { error } = await admin.from("external_entity_links").delete().in("id", linkIds);
  if (error) throw new Error(`cleanupOrphanLinks: ${error.message}`);
}

async function findLink(
  admin: SupabaseClient,
  tenantId: string,
  sourceEntityType: string,
  sourceEntityId: string,
  entityType: CanonicalEntity,
): Promise<string | null> {
  const { data, error } = await admin
    .from("external_entity_links")
    .select("id, entity_id")
    .eq("tenant_id", tenantId)
    .in("source", [...LEGACY_SM_SOURCES])
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .order("promoted_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`findLink: ${error.message}`);

  const orphanLinkIds: string[] = [];
  for (const row of data ?? []) {
    const entityId = (row as { entity_id?: string | null }).entity_id ?? null;
    const linkId = (row as { id?: string | null }).id ?? null;
    if (!entityId || !linkId) continue;
    if (await canonicalEntityExists(admin, tenantId, entityType, entityId)) {
      if (orphanLinkIds.length > 0) await cleanupOrphanLinks(admin, orphanLinkIds);
      return entityId;
    }
    orphanLinkIds.push(linkId);
  }

  if (orphanLinkIds.length > 0) await cleanupOrphanLinks(admin, orphanLinkIds);
  return null;
}

// Lista os source_entity_id já promovidos para um tipo canônico no tenant.
// Usado para excluir staging já processado do batch de candidatos (escala).
async function fetchPromotedSourceIds(
  admin: SupabaseClient,
  tenantId: string,
  sourceEntityType: string,
  entityType: CanonicalEntity,
): Promise<string[]> {
  const pageSize = 1000;
  const out: string[] = [];

  // Proposta só conta como promovida quando a proposta existe e já tem deal_id.
  // Lê direto do canônico para não depender de links órfãos nem montar .in() gigante.
  if (sourceEntityType === "proposta" && entityType === "proposta") {
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("propostas_nativas")
        .select("external_id")
        .eq("tenant_id", tenantId)
        .in("external_source", [...LEGACY_SM_SOURCES])
        .not("deal_id", "is", null)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`fetchPromotedSourceIds propostas: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data) {
        const sourceEntityId = pickStr((r as AnyObj).external_id);
        if (sourceEntityId) out.push(sourceEntityId);
      }
      if (data.length < pageSize) break;
    }
    return out;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("external_entity_links")
      .select("id, source_entity_id, entity_id")
      .eq("tenant_id", tenantId)
      .in("source", [...LEGACY_SM_SOURCES])
      .eq("source_entity_type", sourceEntityType)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchPromotedSourceIds: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const sourceEntityId = pickStr((r as AnyObj).source_entity_id);
      if (sourceEntityId) out.push(sourceEntityId);
    }
    if (data.length < pageSize) break;
  }
  return out;
}

async function upsertLink(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  entityType: CanonicalEntity,
  entityId: string,
  sourceEntityType: string,
  sourceEntityId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await admin.from("external_entity_links").upsert(
    {
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      source: SOURCE,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      promoted_at: new Date().toISOString(),
      promotion_job_id: jobId,
      metadata,
    },
    { onConflict: "tenant_id,source,source_entity_type,source_entity_id" },
  );
  if (error) throw new Error(`upsertLink ${entityType}/${sourceEntityId}: ${error.message}`);
}

// ─── Normalizadores SM → canônico ────────────────────────────────────────────
type AnyObj = Record<string, any>;

function pickStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function pickNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function onlyDigits(v: unknown): string | null {
  const s = pickStr(v);
  return s ? s.replace(/\D+/g, "") || null : null;
}

// ─── Formatadores nativos (RB-62) ───────────────────────────────────────────
// Inline para evitar dependência de import path em Deno isolate.
// Espelho de src/lib/migrationFormatters.ts — manter SINCRONIZADO.
function fmtPhoneBR(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D+/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length === 9
    ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
function fmtCpfCnpj(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const d = String(raw).replace(/\D+/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return null;
}
function fmtCep(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const d = String(raw).replace(/\D+/g, "");
  return d.length === 8 ? `${d.slice(0,5)}-${d.slice(5)}` : null;
}
function fmtName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return null;
  const lower = new Set(["de","da","do","dos","das","e","di","du"]);
  return s.toLowerCase().split(" ").map((w, i) => {
    if (i > 0 && lower.has(w)) return w;
    return w.split("-").map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join("-");
  }).join(" ");
}
function fmtEmail(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function normalizeSmClient(raw: AnyObj) {
  const c = raw?.client ?? raw ?? {};
  // Dígitos para lookups/UNIQUE; formatado para gravação visível.
  const phoneDigits = onlyDigits(c.primaryPhone ?? c.phone ?? c.telefone) ?? "";
  const docDigits = onlyDigits(c.cnpjCpf ?? c.cpfCnpj ?? c.cpf_cnpj) ?? "";
  const cepDigits = onlyDigits(c.zipCode ?? c.cep) ?? "";
  const phoneFmt = fmtPhoneBR(phoneDigits);
  const docFmt = fmtCpfCnpj(docDigits);
  const cepFmt = fmtCep(cepDigits);
  return {
    external_id: pickStr(c.id ?? raw.id),
    nome: fmtName(c.name ?? c.nome) ?? "Cliente sem nome",
    email: fmtEmail(c.email),
    // RB-62: telefone formatado p/ exibição; telefone_digits p/ dedup/UNIQUE.
    // Fallback: se não bate no padrão BR (10/11 dígitos), grava os dígitos brutos
    // para o usuário enxergar e corrigir depois — em vez de aparecer vazio.
    telefone: phoneFmt ?? (phoneDigits ? phoneDigits : ""),
    telefone_digits: phoneDigits,
    // CPF/CNPJ formatado quando válido; senão null e raw vai p/ observacoes.
    cpf_cnpj: docFmt,
    cpf_cnpj_digits: docDigits,
    cep: cepFmt,
    estado: pickStr(c.state ?? c.estado),
    cidade: pickStr(c.city ?? c.cidade),
    bairro: pickStr(c.neighborhood ?? c.bairro),
    rua: pickStr(c.street ?? c.address ?? c.rua),
    numero: pickStr(c.number ?? c.numero),
    complemento: pickStr(c.complement ?? c.complemento),
    empresa: pickStr(c.company),
  };
}

function normalizeSmProject(raw: AnyObj) {
  return {
    external_id: pickStr(raw.id),
    nome: pickStr(raw.name) ?? "Projeto SolarMarket",
    descricao: pickStr(raw.description),
    client_external_id: pickStr(raw.client?.id),
    client: raw.client ?? null,
    responsible_email: pickStr(raw.responsible?.email),
    responsible_name: pickStr(raw.responsible?.name),
    created_at_source: pickStr(raw.createdAt),
  };
}

function normalizeSmProposal(raw: AnyObj) {
  const pricing = Array.isArray(raw.pricingTable) ? raw.pricingTable : [];
  const variables = Array.isArray(raw.variables) ? raw.variables : [];
  const smVars: Record<string, unknown> = {};
  for (const v of variables as AnyObj[]) {
    const byKey = pickStr(v?.key);
    const byItem = pickStr(v?.item);
    if (byKey) smVars[byKey] = v?.value ?? v?.formattedValue ?? null;
    if (byItem) smVars[byItem] = v?.value ?? v?.formattedValue ?? null;
  }
  const pricingTotal = pricing.reduce(
    (acc: number, it: AnyObj) => acc + (pickNum(it.salesValue ?? it.totalValue) ?? 0),
    0,
  );
  const valor_total = pricingTotal > 0
    ? pricingTotal
    : (pickNum(smVars.preco) ?? pickNum(smVars.preco_total) ?? pickNum(smVars.preco_kits) ?? 0);
  // CRÍTICO: em alguns tenants `payload.id` colide (ex.: 10 valores p/ 1.823 propostas).
  // O identificador realmente único é `_sm_project_id` (1 proposta por projeto SM).
  // Fallback: id legado (mantém compatibilidade com tenants antigos sem colisão).
  const externalId = pickStr(raw._sm_project_id) ?? pickStr(raw.project?.id) ?? pickStr(raw.id);
  return {
    external_id: externalId,
    nome: pickStr(raw.name) ?? "Proposta SolarMarket",
    descricao: pickStr(raw.description),
    status_source: pickStr(raw.status),
    link_pdf: pickStr(raw.linkPdf),
    project_external_id: pickStr(raw.project?.id),
    project_name: pickStr(raw.project?.name),
    created_at_source: pickStr(raw.createdAt),
    generated_at: pickStr(raw.generatedAt),
    sent_at: pickStr(raw.sendAt),
    viewed_at: pickStr(raw.viewedAt),
    accepted_at: pickStr(raw.acceptanceDate),
    rejected_at: pickStr(raw.rejectionDate),
    expires_at: pickStr(raw.expirationDate),
    valor_total: valor_total > 0 ? valor_total : null,
    pricing_table: pricing,
    variables,
  };
}

function resolveProposalSourceKey(rawRow: AnyObj): string | null {
  const rawExternalId = pickStr(rawRow?.external_id);
  if (rawExternalId) return rawExternalId.split(":")[0] || rawExternalId;

  const payload = (rawRow?.payload as AnyObj | undefined) ?? rawRow;
  return normalizeSmProposal(payload).external_id ?? pickStr(rawRow?.external_id);
}

// Builder de snapshot canônico mínimo (compatível com resolveAllVariables).
// Mantém raw_sm para auditoria. Estrutura plana com chaves canônicas.
function buildCanonicalSnapshot(args: {
  cliente: ReturnType<typeof normalizeSmClient>;
  projeto: ReturnType<typeof normalizeSmProject>;
  proposta: ReturnType<typeof normalizeSmProposal>;
  rawClient: AnyObj;
  rawProject: AnyObj;
  rawProposal: AnyObj;
}): AnyObj {
  const { cliente, projeto, proposta } = args;

  // Variáveis SM viram um dicionário item→value para facilitar lookup
  const smVars: Record<string, unknown> = {};
  for (const v of proposta.variables as AnyObj[]) {
    const key = pickStr(v?.key);
    const k = pickStr(v?.item);
    if (key) smVars[key] = v?.value ?? v?.formattedValue ?? null;
    if (k) smVars[k] = v?.value ?? v?.formattedValue ?? null;
  }

  return {
    source: SOURCE,
    source_version: "v3",
    cliente: {
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      cpf_cnpj: cliente.cpf_cnpj,
      endereco: {
        cep: cliente.cep,
        rua: cliente.rua,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
      },
    },
    projeto: {
      nome: projeto.nome,
      descricao: projeto.descricao,
    },
    financeiro: {
      valor_total: proposta.valor_total,
      pricing_table: proposta.pricing_table,
    },
    geracao: {
      potencia_kwp: pickNum(smVars["Potência do Sistema (kWp)"] ?? smVars["potencia_kwp"] ?? smVars["potencia_sistema"]),
      geracao_mensal: pickNum(smVars["Geração Mensal (kWh)"]),
      geracao_anual: pickNum(smVars["Geração Anual (kWh)"]),
    },
    kit: {
      nome: pickStr(smVars["Nome do Kit"]) ?? proposta.nome,
      itens: proposta.pricing_table,
    },
    pagamento: {
      condicao: pickStr(smVars["Condição de Pagamento"]),
      valor_total: proposta.valor_total,
    },
    proposta: {
      titulo: proposta.nome,
      status_source: proposta.status_source,
      link_pdf: proposta.link_pdf,
      generated_at: proposta.generated_at,
      sent_at: proposta.sent_at,
      accepted_at: proposta.accepted_at,
      expires_at: proposta.expires_at,
    },
    sm_variables: smVars,
    raw_sm: {
      client: args.rawClient,
      project: args.rawProject,
      proposal: args.rawProposal,
    },
  };
}

// ─── Promotores canônicos ────────────────────────────────────────────────────

/**
 * ClienteCache — cache em memória (escopo do chunk) para evitar N+1 de SELECTs
 * em `clientes` ao promover múltiplos clientes do mesmo lote.
 *
 * Estrutura: 5 índices (external_id, cliente_code, cpf_cnpj, telefone_normalized, email)
 * apontando para o mesmo `id` canônico. Populado por `prefetchClienteCache` com
 * UMA query bulk no início do chunk; `promoteCliente` consulta antes de cair
 * nos 5 SELECTs paralelos da Fase A.
 *
 * Não substitui a verificação por link (`external_entity_links`), que é SSOT
 * de idempotência (RB-64) e permanece como primeiro passo.
 */
export type ClienteCache = {
  byExternalId: Map<string, string>;
  byCode: Map<string, string>;
  byDoc: Map<string, string>;
  byPhone: Map<string, string>;
  byEmail: Map<string, string>;
};

export function emptyClienteCache(): ClienteCache {
  return {
    byExternalId: new Map(),
    byCode: new Map(),
    byDoc: new Map(),
    byPhone: new Map(),
    byEmail: new Map(),
  };
}

/**
 * Pré-busca em UMA query todos os clientes existentes do tenant que casam
 * com qualquer identificador do lote de raws. Reduz N×5 SELECTs para 1.
 */
export async function prefetchClienteCache(
  admin: SupabaseClient,
  tenantId: string,
  rawClientes: AnyObj[],
): Promise<ClienteCache> {
  const cache = emptyClienteCache();
  if (!rawClientes.length) return cache;

  const extIds = new Set<string>();
  const codes = new Set<string>();
  const docs = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();

  for (const raw of rawClientes) {
    const n = normalizeSmClient(raw);
    if (!n.external_id) continue;
    extIds.add(n.external_id);
    codes.add(`SM-${n.external_id}`.slice(0, 32));
    if (n.cpf_cnpj_digits) docs.add(n.cpf_cnpj_digits);
    if (n.cpf_cnpj && n.cpf_cnpj !== n.cpf_cnpj_digits) docs.add(n.cpf_cnpj);
    if (n.telefone_digits) phones.add(n.telefone_digits);
    if (n.email) emails.add(n.email);
  }

  if (!extIds.size && !codes.size && !docs.size && !phones.size && !emails.size) {
    return cache;
  }

  // OR composto numa única query — Postgres usa os índices apropriados.
  const orParts: string[] = [];
  if (extIds.size) orParts.push(`external_id.in.(${Array.from(extIds).map((v) => `"${v}"`).join(",")})`);
  if (codes.size) orParts.push(`cliente_code.in.(${Array.from(codes).map((v) => `"${v}"`).join(",")})`);
  if (docs.size) orParts.push(`cpf_cnpj.in.(${Array.from(docs).map((v) => `"${v}"`).join(",")})`);
  if (phones.size) orParts.push(`telefone_normalized.in.(${Array.from(phones).map((v) => `"${v}"`).join(",")})`);
  if (emails.size) orParts.push(`email.in.(${Array.from(emails).map((v) => `"${v}"`).join(",")})`);

  const { data, error } = await admin
    .from("clientes")
    .select("id, external_id, cliente_code, cpf_cnpj, telefone_normalized, email")
    .eq("tenant_id", tenantId)
    .or(orParts.join(","));

  if (error || !data) return cache; // fallback gracioso: caminho normal cobre

  for (const row of data as AnyObj[]) {
    const id = row.id as string;
    if (row.external_id) cache.byExternalId.set(String(row.external_id), id);
    if (row.cliente_code) cache.byCode.set(String(row.cliente_code), id);
    if (row.cpf_cnpj) cache.byDoc.set(String(row.cpf_cnpj), id);
    if (row.telefone_normalized) cache.byPhone.set(String(row.telefone_normalized), id);
    if (row.email) cache.byEmail.set(String(row.email).toLowerCase(), id);
  }
  return cache;
}

async function promoteCliente(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  rawCliente: AnyObj,
  cache?: ClienteCache,
): Promise<{ id: string; created: boolean; matchedBy?: string }> {
  const norm = normalizeSmClient(rawCliente);
  if (!norm.external_id) throw new Error("Cliente SM sem id");

  const clienteCode = `SM-${norm.external_id}`.slice(0, 32);

  // 1) Link existente (idempotência canônica - RB-64, SSOT)
  const existing = await findLink(admin, tenantId, "cliente", norm.external_id, "cliente");
  if (existing) return { id: existing, created: false, matchedBy: "link" };

  // 1.5) PERFORMANCE (Fase B): consulta cache do chunk antes de SELECTs.
  // Mesma ordem de prioridade da Fase A. Hit no cache = 0 round-trips de dedup.
  if (cache) {
    const docKey = norm.cpf_cnpj_digits || norm.cpf_cnpj || "";
    const emailKey = norm.email?.toLowerCase() || "";
    const cachedId =
      (norm.external_id && cache.byExternalId.get(norm.external_id)) ||
      cache.byCode.get(clienteCode) ||
      (docKey && cache.byDoc.get(docKey)) ||
      (norm.telefone_digits && cache.byPhone.get(norm.telefone_digits)) ||
      (emailKey && cache.byEmail.get(emailKey)) ||
      null;
    if (cachedId) {
      await upsertLink(admin, tenantId, jobId, "cliente", cachedId, "cliente", norm.external_id, { matched_by: "cache" });
      return { id: cachedId, created: false, matchedBy: "cache" };
    }
  }

  // 2-5) PERFORMANCE (Fase A): paraleliza os 5 lookups de dedup independentes.
  // Antes: 5 SELECTs sequenciais (~250ms). Depois: 5 em paralelo (~50ms).
  // Mantém EXATAMENTE a mesma ordem de prioridade ao avaliar resultados:
  //   external_id (legado) > cliente_code > CPF/CNPJ > telefone > email.
  // Lógica, dedup, idempotência e formatação permanecem intactas (RB-62/RB-64).
  const docLookup = norm.cpf_cnpj_digits || norm.cpf_cnpj;

  const [byExtRes, byCodeRes, byDocRes, byPhoneRes, byEmailRes] = await Promise.all([
    admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("external_source", [...LEGACY_SM_SOURCES])
      .eq("external_id", norm.external_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("cliente_code", clienteCode)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    docLookup
      ? admin
          .from("clientes")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("cpf_cnpj", docLookup)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: { id: string } | null }),
    norm.telefone_digits
      ? admin
          .from("clientes")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("telefone_normalized", norm.telefone_digits)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: { id: string } | null }),
    norm.email
      ? admin
          .from("clientes")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("email", norm.email)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null } as { data: { id: string } | null }),
  ]);

  // Avalia na MESMA ordem de prioridade da implementação sequencial original.
  if (byExtRes.data?.id) {
    const id = byExtRes.data.id as string;
    await upsertLink(admin, tenantId, jobId, "cliente", id, "cliente", norm.external_id, { matched_by: "external_id" });
    return { id, created: false, matchedBy: "external_id" };
  }
  if (byCodeRes.data?.id) {
    const id = byCodeRes.data.id as string;
    await upsertLink(admin, tenantId, jobId, "cliente", id, "cliente", norm.external_id, { matched_by: "cliente_code" });
    return { id, created: false, matchedBy: "cliente_code" };
  }
  if (byDocRes.data?.id) {
    const id = byDocRes.data.id as string;
    await upsertLink(admin, tenantId, jobId, "cliente", id, "cliente", norm.external_id, { matched_by: "cpf_cnpj_digits" });
    return { id, created: false, matchedBy: "cpf_cnpj" };
  }
  if (byPhoneRes.data?.id) {
    const id = byPhoneRes.data.id as string;
    await upsertLink(admin, tenantId, jobId, "cliente", id, "cliente", norm.external_id, { matched_by: "telefone" });
    return { id, created: false, matchedBy: "telefone" };
  }
  if (byEmailRes.data?.id) {
    const id = byEmailRes.data.id as string;
    await upsertLink(admin, tenantId, jobId, "cliente", id, "cliente", norm.external_id, { matched_by: "email" });
    return { id, created: false, matchedBy: "email" };
  }

  // 6) Não existe — inserir novo (RB-62: campos formatados; telefone_normalized só dígitos)
  const { data, error } = await admin
    .from("clientes")
    .insert({
      tenant_id: tenantId,
      cliente_code: clienteCode,
      nome: norm.nome,
      telefone: norm.telefone || "",
      telefone_normalized: norm.telefone_digits || null,
      email: norm.email,
      cpf_cnpj: norm.cpf_cnpj,
      cep: norm.cep,
      estado: norm.estado,
      cidade: norm.cidade,
      bairro: norm.bairro,
      rua: norm.rua,
      numero: norm.numero,
      complemento: norm.complemento,
      empresa: norm.empresa,
      origem: SOURCE,
      external_source: SOURCE,
      external_id: norm.external_id,
      ativo: true,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    const message = error?.message ?? "sem id";
    // Tratamento robusto de race condition entre promoções paralelas (PARALLEL_CHUNK=5):
    // 5 propostas com o mesmo cliente leem reconciliação NULL ao mesmo tempo, todas tentam INSERT,
    // uma vence as constraints (telefone, cpf_cnpj, cliente_code) e as outras morrem.
    // Em vez de jogar throw, re-procuramos pelos índices únicos conhecidos.
    const isDup = /duplicate key value|unique constraint/i.test(message);
    if (isDup) {
      const externalIdSafe = norm.external_id ?? "";
      const tryFind = async (
        column: "telefone_normalized" | "cpf_cnpj" | "cliente_code" | "external_id",
        value: string | null | undefined,
        matchedBy: string,
      ): Promise<{ id: string; created: false; matchedBy: string } | null> => {
        if (!value) return null;
        const { data: row } = await admin
          .from("clientes")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq(column, value)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!row?.id) return null;
        if (externalIdSafe) {
          await upsertLink(admin, tenantId, jobId, "cliente", row.id as string, "cliente", externalIdSafe, { matched_by: matchedBy });
        }
        return { id: row.id as string, created: false, matchedBy };
      };

      const found =
        (await tryFind("external_id", norm.external_id, "external_id_race")) ??
        (await tryFind("telefone_normalized", norm.telefone_digits, "telefone_race")) ??
        (await tryFind("cpf_cnpj", norm.cpf_cnpj_digits, "cpf_cnpj_digits_race")) ??
        (await tryFind("cpf_cnpj", norm.cpf_cnpj, "cpf_cnpj_race")) ??
        (await tryFind("cliente_code", clienteCode, "cliente_code_race"));
      if (found) return found;
    }
    throw new Error(`insert cliente: ${message}`);
  }

  await upsertLink(admin, tenantId, jobId, "cliente", data.id as string, "cliente", norm.external_id);
  return { id: data.id as string, created: true, matchedBy: "insert" };
}

/**
 * Mapeia status canônico da PROPOSTA → status válido do enum `projeto_status`.
 * Enum real (auditado em 2026-04): criado, aguardando_documentacao, em_analise,
 * aprovado, em_instalacao, instalado, comissionado, concluido, cancelado.
 * NÃO existe "lead" — usar "criado" como fallback seguro.
 */
function mapProjetoStatusFromPromotion(canonicalPropostaStatus: string): string {
  switch (canonicalPropostaStatus) {
    case "aceita":
      return "aprovado";
    case "recusada":
    case "expirada":
    case "cancelada":
      return "cancelado";
    case "rascunho":
    case "gerada":
    case "enviada":
    default:
      return "criado";
  }
}

async function promoteProjeto(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  rawProjeto: AnyObj,
  clienteId: string,
  pipeline: PipelineResolution,
  consultorId: string | null,
  canonicalStatus: string,
): Promise<{ id: string; created: boolean }> {
  const norm = normalizeSmProject(rawProjeto);
  if (!norm.external_id) throw new Error("Projeto SM sem id");

  const existing = await findLink(admin, tenantId, "projeto", norm.external_id, "projeto");
  if (existing) return { id: existing, created: false };

  const codigo = `SM-PROJ-${norm.external_id}`.slice(0, 32);
  let stageId = resolveStageForStatus(pipeline, canonicalStatus);

  // Hardening: revalida etapa_id contra projeto_etapas (FK projetos_etapa_id_fkey).
  // Se o id resolvido não existir (ex.: cache stale, funil trocado), busca a 1ª etapa do funil.
  if (pipeline.funilId) {
    if (stageId) {
      const { data: ck } = await admin
        .from("projeto_etapas").select("id")
        .eq("tenant_id", tenantId).eq("funil_id", pipeline.funilId).eq("id", stageId)
        .maybeSingle();
      if (!ck?.id) stageId = null;
    }
    if (!stageId) {
      const { data: first } = await admin
        .from("projeto_etapas").select("id")
        .eq("tenant_id", tenantId).eq("funil_id", pipeline.funilId)
        .order("ordem", { ascending: true }).limit(1).maybeSingle();
      stageId = (first?.id as string | undefined) ?? null;
    }
    if (!stageId) {
      throw new Error(`promoteProjeto: nenhuma etapa válida em projeto_etapas para funil_id=${pipeline.funilId}`);
    }
  }

  const insertPayload: AnyObj = {
    tenant_id: tenantId,
    cliente_id: clienteId,
    codigo,
    status: mapProjetoStatusFromPromotion(canonicalStatus),
    observacoes: norm.descricao,
    // Rastreabilidade SolarMarket (idempotência também via external_entity_links).
    external_source: SOURCE,
    external_id: norm.external_id,
  };
  if (pipeline.funilId) insertPayload.funil_id = pipeline.funilId;
  if (stageId) insertPayload.etapa_id = stageId;
  if (consultorId) insertPayload.consultor_id = consultorId;

  const { data, error } = await admin
    .from("projetos")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !data?.id) {
    const message = error?.message ?? "sem retorno";
    const isDuplicate = error?.code === "23505" || /duplicate key|unique constraint|uq_projetos_tenant_codigo/i.test(message);
    if (isDuplicate) {
      const { data: existingProject, error: existingErr } = await admin
        .from("projetos")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("codigo", codigo)
        .maybeSingle();
      if (!existingErr && existingProject?.id) {
        await upsertLink(admin, tenantId, jobId, "projeto", existingProject.id as string, "projeto", norm.external_id, {
          matched_by: "codigo_duplicate_recovery",
        });
        return { id: existingProject.id as string, created: false };
      }
    }
    throw new Error(`insert projeto: ${message}`);
  }

  await upsertLink(admin, tenantId, jobId, "projeto", data.id as string, "projeto", norm.external_id);
  return { id: data.id as string, created: true };
}

async function promoteProposta(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  rawProposta: AnyObj,
  ctx: { clienteId: string; projetoId: string; snapshot: AnyObj; userId: string | null; consultorId: string | null },
): Promise<{ propostaId: string; versaoId: string; created: boolean }> {
  const norm = normalizeSmProposal(rawProposta);
  if (!norm.external_id) throw new Error("Proposta SM sem id");

  const existing = await findLink(admin, tenantId, "proposta", norm.external_id, "proposta");
  if (existing) {
    // Garante que existe pelo menos uma versão; senão cria.
    const { data: v } = await admin
      .from("proposta_versoes")
      .select("id").eq("tenant_id", tenantId).eq("proposta_id", existing).limit(1).maybeSingle();
    if (v?.id) return { propostaId: existing, versaoId: v.id as string, created: false };
    const versaoId = await insertVersao(admin, tenantId, existing, ctx.snapshot, norm, ctx.userId);
    return { propostaId: existing, versaoId, created: false };
  }

  const codigo = `SM-PROP-${norm.external_id}`.slice(0, 32);
  const { status } = mapSmStatus(norm.status_source, norm.accepted_at);

  // Idempotência: se já existe proposta com (tenant_id, codigo), reaproveita
  // sem tentar inserir (evita erro 23505 em uq_propostas_tenant_codigo).
  const { data: preExisting } = await admin
    .from("propostas_nativas")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("codigo", codigo)
    .maybeSingle();

  if (preExisting?.id) {
    const propostaId = preExisting.id as string;
    const { data: v } = await admin
      .from("proposta_versoes")
      .select("id").eq("tenant_id", tenantId).eq("proposta_id", propostaId).limit(1).maybeSingle();
    const versaoId = (v?.id as string | undefined)
      ?? await insertVersao(admin, tenantId, propostaId, ctx.snapshot, norm, ctx.userId);
    await upsertLink(admin, tenantId, jobId, "proposta", propostaId, "proposta", norm.external_id, {
      versao_id: versaoId,
      recovered_from_conflict: true,
    });
    return { propostaId, versaoId, created: false };
  }

  const { data: pn, error: pnErr } = await admin
    .from("propostas_nativas")
    .insert({
      tenant_id: tenantId,
      cliente_id: ctx.clienteId,
      projeto_id: ctx.projetoId,
      consultor_id: ctx.consultorId,
      titulo: norm.nome,
      codigo,
      versao_atual: 1,
      // chk_origem aceita apenas 'native' | 'imported'. Rastro do SM fica em external_source/external_id.
      origem: "imported",
      status,
      enviada_at: norm.sent_at,
      aceita_at: norm.accepted_at,
      recusada_at: norm.rejected_at,
      external_source: SOURCE,
      external_id: norm.external_id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  let propostaId: string | null = pn?.id as string | undefined ?? null;
  let createdNow = !pnErr && !!propostaId;

  // Recuperação de conflito 23505 em uq_propostas_tenant_codigo:
  // a proposta já existe no CRM mas o link não foi gravado (ex.: job anterior
  // crashou após o insert). Reaproveita a proposta existente em vez de quebrar.
  if (pnErr) {
    const message = pnErr.message ?? "";
    const isDup = (pnErr as { code?: string }).code === "23505"
      || /uq_propostas_tenant_codigo|duplicate key/i.test(message);
    if (!isDup) throw new Error(`insert proposta: ${message}`);

    const { data: existingProp, error: lookupErr } = await admin
      .from("propostas_nativas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("codigo", codigo)
      .maybeSingle();
    if (lookupErr || !existingProp?.id) {
      throw new Error(`insert proposta: ${message} (lookup falhou: ${lookupErr?.message ?? "não encontrado"})`);
    }
    propostaId = existingProp.id as string;
    createdNow = false;
  }

  if (!propostaId) throw new Error(`insert proposta: id nulo após recuperação`);

  // Garante que existe pelo menos uma versão para a proposta reaproveitada.
  let versaoId: string;
  if (createdNow) {
    versaoId = await insertVersao(admin, tenantId, propostaId, ctx.snapshot, norm, ctx.userId);
  } else {
    const { data: v } = await admin
      .from("proposta_versoes")
      .select("id").eq("tenant_id", tenantId).eq("proposta_id", propostaId).limit(1).maybeSingle();
    versaoId = (v?.id as string | undefined)
      ?? await insertVersao(admin, tenantId, propostaId, ctx.snapshot, norm, ctx.userId);
  }

  await upsertLink(admin, tenantId, jobId, "proposta", propostaId, "proposta", norm.external_id, {
    versao_id: versaoId,
    recovered_from_conflict: !createdNow ? true : undefined,
  });
  return { propostaId, versaoId, created: createdNow };
}

async function insertVersao(
  admin: SupabaseClient,
  tenantId: string,
  propostaId: string,
  snapshot: AnyObj,
  norm: ReturnType<typeof normalizeSmProposal>,
  userId: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("proposta_versoes")
    .insert({
      tenant_id: tenantId,
      proposta_id: propostaId,
      versao_numero: 1,
      // Enum proposta_nativa_status: draft|generated|sent|accepted|rejected|expired|excluida|arquivada
      // Versão promovida do SolarMarket entra como "generated" (já existe materializada, não é rascunho).
      status: "generated",
      valor_total: norm.valor_total,
      potencia_kwp: pickNum((snapshot as AnyObj).geracao?.potencia_kwp),
      snapshot,
      gerado_por: userId,
      gerado_em: norm.generated_at ?? new Date().toISOString(),
      link_pdf: norm.link_pdf,
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`insert versao: ${error?.message}`);
  return data.id as string;
}

// ─── Resolver de pipeline / etapa (DA-40: sem hardcode) ─────────────────────
interface PipelineResolution {
  funilId: string | null;
  etapaId: string | null;                 // etapa default (fallback quando status não casa)
  hasPipelineConfigured: boolean;
  /** Mapa status canônico → etapa_id nativa de projeto. */
  stageByStatus: Record<string, string>;
  /** Etapa operacional exata vinda do funil/etapa SM, quando mapeável por nome. */
  smEtapaId?: string | null;
}

/**
 * Mapeamento status canônico → nome do stage no pipeline Comercial.
 * Match case-insensitive, normalizado (sem acento).
 */
const STATUS_STAGE_NAME: Record<string, string[]> = {
  rascunho: ["novo lead", "recebido", "lead", "novo"],
  gerada:   ["proposta criada", "enviar proposta", "proposta gerada"],
  enviada:  ["proposta enviada", "enviada", "negociacao", "negociação", "qualificado"],
  aceita:   ["fechado", "ganho", "venda fechada", "aceita"],
  recusada: ["perdido", "recusado", "perdida"],
  expirada: ["expirado", "expirada"],
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function resolveDefaultPipeline(
  admin: SupabaseClient,
  tenantId: string,
): Promise<PipelineResolution> {
  const { data: anyFunil } = await admin
    .from("projeto_funis").select("id").eq("tenant_id", tenantId).eq("ativo", true).limit(1);
  const hasPipelineConfigured = (anyFunil?.length ?? 0) > 0;
  if (!hasPipelineConfigured) {
    return { funilId: null, etapaId: null, hasPipelineConfigured: false, stageByStatus: {} };
  }

  let funilId: string | undefined;

  const { data: fComercial } = await admin
    .from("projeto_funis").select("id")
    .eq("tenant_id", tenantId).eq("ativo", true).ilike("nome", "comercial").limit(1).maybeSingle();
  funilId = fComercial?.id as string | undefined;

  if (!funilId) {
    const { data: fFirst } = await admin
      .from("projeto_funis").select("id").eq("tenant_id", tenantId).eq("ativo", true)
      .order("ordem", { ascending: true }).limit(1).maybeSingle();
    funilId = fFirst?.id as string | undefined;
  }
  if (!funilId) return { funilId: null, etapaId: null, hasPipelineConfigured: true, stageByStatus: {} };

  const { data: stages } = await admin
    .from("projeto_etapas").select("id, nome, ordem")
    .eq("tenant_id", tenantId).eq("funil_id", funilId)
    .order("ordem", { ascending: true });

  const list = (stages ?? []) as Array<{ id: string; nome: string; ordem: number }>;
  const etapaId = list[0]?.id ?? null;

  const stageByStatus: Record<string, string> = {};
  for (const [status, aliases] of Object.entries(STATUS_STAGE_NAME)) {
    const aliasesNorm = aliases.map(norm);
    const found = list.find((s) => aliasesNorm.includes(norm(s.nome)));
    if (found) stageByStatus[status] = found.id;
  }

  return { funilId, etapaId, hasPipelineConfigured: true, stageByStatus };
}

/** Resolve etapa para um status canônico, com fallback para etapa default. */
function resolveStageForStatus(pipeline: PipelineResolution, status: string): string | null {
  return pipeline.smEtapaId ?? pipeline.stageByStatus[status] ?? pipeline.etapaId;
}

function findPipelineStageForSmEtapa(stages: AnyObj[], smEtapaName: string | null | undefined): string | null {
  const smName = String(smEtapaName ?? "").trim();
  if (!smName) return null;
  const normalized = norm(smName);
  const exact = stages.find((s) => norm(String(s.name ?? "")) === normalized);
  if (exact?.id) return exact.id as string;
  if (["fechado", "ganho", "ganha", "venda fechada"].includes(normalized)) {
    const won = stages.find((s) => Boolean(s.is_won));
    if (won?.id) return won.id as string;
  }
  return null;
}

// ─── Resolução de pipeline POR PROJETO (sm_funil_pipeline_map) ───────────────
/**
 * Para o projeto SM informado, descobre o funil SM associado (em
 * sm_projeto_funis_raw, role !== "vendedores") e resolve:
 *   - dealPipelineId / dealStageByStatus  → tabela `pipelines`/`pipeline_stages` (Comercial)
 *   - funilExecId / etapaExecByStatus     → tabela `projeto_funis`/`projeto_etapas` (espelho por nome)
 *
 * Se nada estiver mapeado, retorna o `defaultPipeline` (resolveDefaultPipeline).
 */
interface PerProjectPipeline extends PipelineResolution {
  dealPipelineId: string | null;            // pipelines.id (Comercial PRINCIPAL)
  dealStageByStatus: Record<string, string>; // status canônico → pipeline_stages.id
  dealStageDefault: string | null;
  /**
   * Pipelines secundários onde o deal também deve aparecer (multi-pipeline).
   * Cada projeto pode estar em vários funis SM ao mesmo tempo (ex.: Comercial + Engenharia + Equipamento).
   * Inserir uma linha em `deal_pipeline_stages` por pipeline secundário dispara
   * `trg_sync_dps_kanban`, que materializa a projeção em `deal_kanban_projection`.
   */
  secondaryPipelines: Array<{ pipelineId: string; stageId: string }>;
}

async function resolveDefaultDealPipeline(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Pick<PerProjectPipeline, "dealPipelineId" | "dealStageByStatus" | "dealStageDefault">> {
  const { data: preferred } = await admin
    .from("pipelines")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("kind", "process")
    .ilike("name", "comercial")
    .limit(1)
    .maybeSingle();

  const pipelineRow = preferred ?? await (async () => {
    const { data: fallback } = await admin
      .from("pipelines")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("kind", "process")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return fallback;
  })();

  const dealPipelineId = pickStr((pipelineRow as AnyObj | null)?.id);
  if (!dealPipelineId) {
    return { dealPipelineId: null, dealStageByStatus: {}, dealStageDefault: null };
  }

  const { data: pStages } = await admin
    .from("pipeline_stages")
    .select("id, name, position")
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", dealPipelineId)
    .order("position", { ascending: true });

  const stagesArr = (pStages ?? []) as Array<AnyObj>;
  const dealStageByStatus: Record<string, string> = {};
  for (const [status, aliases] of Object.entries(STATUS_STAGE_NAME)) {
    const aliasesNorm = aliases.map(norm);
    const found = stagesArr.find((s) => aliasesNorm.includes(norm(String(s.name ?? ""))));
    if (found) dealStageByStatus[status] = found.id as string;
  }

  return {
    dealPipelineId,
    dealStageByStatus,
    dealStageDefault: (stagesArr[0]?.id as string | undefined) ?? null,
  };
}

async function resolvePipelinePerProject(
  admin: SupabaseClient,
  tenantId: string,
  projectExtId: string | null | undefined,
  defaultPipeline: PipelineResolution,
): Promise<PerProjectPipeline> {
  const defaultDeal = await resolveDefaultDealPipeline(admin, tenantId);
  const empty: PerProjectPipeline = {
    ...defaultPipeline,
    ...defaultDeal,
    secondaryPipelines: [],
  };

  if (!projectExtId) return empty;

  // 1) Funis SM associados ao projeto (excluindo "vendedores", que é de consultor)
  const { data: funisRows } = await admin
    .from("sm_projeto_funis_raw")
    .select("payload")
    .eq("tenant_id", tenantId)
    .eq("payload->project->>id", projectExtId);

  const candidates = (funisRows ?? [])
    .map((r: AnyObj) => {
      const fname = String((r.payload as AnyObj)?.name ?? "").trim();
      const sname = String((r.payload as AnyObj)?.stage?.name ?? "").trim();
      return { funilName: fname, stageName: sname };
    })
    .filter((c) => c.funilName && c.funilName.toLowerCase() !== "vendedores");

  const effectiveCandidates = candidates.length > 0
    ? candidates
    : [{ funilName: "LEAD", stageName: "" }];

  // 2) Para cada funil candidato, busca mapping em sm_funil_pipeline_map
  const funilNames = Array.from(new Set(effectiveCandidates.map((c) => c.funilName)));
  const { data: maps } = await admin
    .from("sm_funil_pipeline_map")
    .select("sm_funil_name, pipeline_id, role")
    .eq("tenant_id", tenantId)
    .in("sm_funil_name", funilNames);

  // Prioriza role="pipeline"; ignora "ignore". Mantém TODOS os válidos para multi-pipeline.
  const validMaps = (maps ?? [])
    .filter((m: AnyObj) => m.role !== "ignore" && m.pipeline_id)
    .sort((a: AnyObj, b: AnyObj) => (a.role === "pipeline" ? -1 : 1)) as AnyObj[];

  const validMap = validMaps[0];
  if (!validMap) return empty;

  const dealPipelineId = validMap.pipeline_id as string;
  const matchedFunilName = validMap.sm_funil_name as string;
  const matchedCandidate = effectiveCandidates.find((c) => c.funilName === matchedFunilName);

  // 3) Buscar pipeline_stages do pipeline comercial mapeado
  const { data: pStages } = await admin
    .from("pipeline_stages")
    .select("id, name, position, is_won, is_closed")
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", dealPipelineId)
    .order("position", { ascending: true });
  const stagesArr = (pStages ?? []) as Array<AnyObj>;

  // Mapeamento etapa SM → pipeline_stages.id (sm_etapa_stage_map)
  const { data: etapaMaps } = await admin
    .from("sm_etapa_stage_map")
    .select("sm_etapa_name, stage_id")
    .eq("tenant_id", tenantId)
    .eq("sm_funil_name", matchedFunilName);

  const stageBySmEtapa = new Map<string, string>();
  for (const em of (etapaMaps ?? []) as AnyObj[]) {
    stageBySmEtapa.set(String(em.sm_etapa_name).toLowerCase().trim(), em.stage_id as string);
  }

  // dealStageByStatus: tenta achar stage pelo nome canônico (mesma heurística do default)
  const dealStageByStatus: Record<string, string> = {};
  for (const [status, aliases] of Object.entries(STATUS_STAGE_NAME)) {
    const aliasesNorm = aliases.map(norm);
    const found = stagesArr.find((s) => aliasesNorm.includes(norm(String(s.name ?? ""))));
    if (found) dealStageByStatus[status] = found.id as string;
  }

  // Stage default = stage mapeada à etapa SM atual do projeto (se houver),
  // senão a primeira do pipeline.
  let dealStageDefault: string | null = null;
  if (matchedCandidate?.stageName) {
    const mapped = stageBySmEtapa.get(matchedCandidate.stageName.toLowerCase().trim());
    if (mapped) dealStageDefault = mapped;
    if (!dealStageDefault) dealStageDefault = findPipelineStageForSmEtapa(stagesArr, matchedCandidate.stageName);
  }
  if (!dealStageDefault) dealStageDefault = (stagesArr[0]?.id as string | undefined) ?? null;

  // 4) Resolver funil de EXECUÇÃO espelho (por nome igual ao do pipeline)
  const { data: pipeRow } = await admin
    .from("pipelines")
    .select("name")
    .eq("id", dealPipelineId)
    .maybeSingle();
  const pipelineName = pickStr((pipeRow as AnyObj | null)?.name);

  let funilExecId: string | null = defaultPipeline.funilId;
  let etapaExecDefault: string | null = defaultPipeline.etapaId;
  let etapaExecByStatus: Record<string, string> = { ...defaultPipeline.stageByStatus };

  if (pipelineName) {
    const { data: funilExec } = await admin
      .from("projeto_funis")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .ilike("nome", pipelineName)
      .maybeSingle();
    if (funilExec?.id) {
      funilExecId = funilExec.id as string;
      const { data: etapas } = await admin
        .from("projeto_etapas")
        .select("id, nome, ordem")
        .eq("tenant_id", tenantId)
        .eq("funil_id", funilExecId)
        .order("ordem", { ascending: true });
      const etapasArr = (etapas ?? []) as Array<AnyObj>;
      etapaExecDefault = (etapasArr[0]?.id as string | undefined) ?? null;
      etapaExecByStatus = {};
      for (const [status, aliases] of Object.entries(STATUS_STAGE_NAME)) {
        const aliasesNorm = aliases.map(norm);
        const found = etapasArr.find((s) => aliasesNorm.includes(norm(String(s.nome ?? ""))));
        if (found) etapaExecByStatus[status] = found.id as string;
      }
      if (matchedCandidate?.stageName) {
        const exact = etapasArr.find((s) => norm(String(s.nome ?? "")) === norm(matchedCandidate.stageName));
        if (exact?.id) etapaExecDefault = exact.id as string;
      }
    }
  }

  // ─── Multi-pipeline: resolver pipelines secundários ────────────────────────
  // Para cada funil SM mapeado adicional (além do principal), resolver:
  //  - pipelineId (já vem do mapping)
  //  - stageId via sm_etapa_stage_map daquele funil; fallback = primeira stage do pipeline
  const secondaryPipelines: Array<{ pipelineId: string; stageId: string }> = [];
  for (const m of validMaps.slice(1)) {
    const secPipelineId = m.pipeline_id as string;
    const secFunilName = m.sm_funil_name as string;
    if (!secPipelineId || secPipelineId === dealPipelineId) continue;

    const secCandidate = effectiveCandidates.find((c) => c.funilName === secFunilName);

    // Stages do pipeline secundário (1ª como fallback)
    const { data: secStages } = await admin
      .from("pipeline_stages")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("pipeline_id", secPipelineId)
      .order("position", { ascending: true })
      .limit(1);
    const secFirstStage = ((secStages ?? [])[0] as AnyObj | undefined)?.id as string | undefined;

    let secStageId: string | null = null;
    if (secCandidate?.stageName) {
      const { data: secEtapaMap } = await admin
        .from("sm_etapa_stage_map")
        .select("stage_id")
        .eq("tenant_id", tenantId)
        .eq("sm_funil_name", secFunilName)
        .ilike("sm_etapa_name", secCandidate.stageName)
        .maybeSingle();
      secStageId = pickStr((secEtapaMap as AnyObj | null)?.stage_id);
      if (!secStageId) {
        const { data: secStagesAll } = await admin
          .from("pipeline_stages")
          .select("id, name, is_won")
          .eq("tenant_id", tenantId)
          .eq("pipeline_id", secPipelineId);
        secStageId = findPipelineStageForSmEtapa((secStagesAll ?? []) as AnyObj[], secCandidate.stageName);
      }
    }
    if (!secStageId) secStageId = secFirstStage ?? null;

    if (secStageId) {
      secondaryPipelines.push({ pipelineId: secPipelineId, stageId: secStageId });
    }
  }

  return {
    funilId: funilExecId,
    etapaId: etapaExecDefault,
    smEtapaId: etapaExecDefault,
    hasPipelineConfigured: defaultPipeline.hasPipelineConfigured,
    stageByStatus: etapaExecByStatus,
    dealPipelineId,
    dealStageByStatus,
    dealStageDefault,
    secondaryPipelines,
  };
}

// ─── Criação de DEAL canônico para projetos migrados ─────────────────────────
/**
 * Cria um `deal` (oportunidade comercial) vinculado ao projeto recém-promovido,
 * e atualiza os FKs `projetos.deal_id` e `propostas_nativas.deal_id`.
 * Idempotente: se o projeto já tem deal_id, reutiliza.
 */
async function createDealForProject(
  admin: SupabaseClient,
  tenantId: string,
  projetoId: string,
  clienteId: string,
  ownerId: string | null,
  pipeline: PerProjectPipeline,
  proposta: { id: string | null; valor_total: number | null; titulo: string | null; status: string },
): Promise<{ dealId: string | null; created: boolean; reason?: string }> {
  // Idempotência: se projeto já tem deal_id, reutiliza
  const { data: projRow } = await admin
    .from("projetos")
    .select("deal_id, codigo")
    .eq("id", projetoId)
    .maybeSingle();
  const existingDealId = (projRow as AnyObj | null)?.deal_id as string | null | undefined;
  if (existingDealId) {
    const stageId = pipeline.dealStageDefault ?? pipeline.dealStageByStatus[proposta.status] ?? null;
    const updatePayload: AnyObj = { value: proposta.valor_total ?? 0 };
    if (pipeline.dealPipelineId) updatePayload.pipeline_id = pipeline.dealPipelineId;
    if (stageId) updatePayload.stage_id = stageId;
    await admin
      .from("deals")
      .update(updatePayload)
      .eq("id", existingDealId)
      .eq("tenant_id", tenantId);
    if (proposta.id) {
      await admin
        .from("propostas_nativas")
        .update({ deal_id: existingDealId })
        .eq("id", proposta.id)
        .eq("tenant_id", tenantId);
    }
    // Multi-pipeline também na re-execução (idempotente)
    if (pipeline.secondaryPipelines.length > 0) {
      const dpsRows = pipeline.secondaryPipelines.map((sp) => ({
        tenant_id: tenantId,
        deal_id: existingDealId,
        pipeline_id: sp.pipelineId,
        stage_id: sp.stageId,
      }));
      await admin
        .from("deal_pipeline_stages")
        .upsert(dpsRows, { onConflict: "deal_id,pipeline_id" });
    }
    return { dealId: existingDealId, created: false, reason: "already_linked" };
  }

  if (!pipeline.dealPipelineId) {
    return { dealId: null, created: false, reason: "no_pipeline_mapped" };
  }
  if (!ownerId) {
    return { dealId: null, created: false, reason: "no_owner" };
  }

  // Stage do deal: por status canônico, senão a default
  const stageId = pipeline.dealStageByStatus[proposta.status] ?? pipeline.dealStageDefault;
  if (!stageId) {
    return { dealId: null, created: false, reason: "no_stage" };
  }

  // Status do deal (text simples; valores comuns: open/won/lost)
  const dealStatus =
    proposta.status === "aceita" ? "won"
    : proposta.status === "recusada" || proposta.status === "expirada" ? "lost"
    : "open";

  const title =
    (proposta.titulo && proposta.titulo.trim()) ||
    `Projeto ${(projRow as AnyObj | null)?.codigo ?? projetoId.slice(0, 8)}`;

  const { data: deal, error: dealErr } = await admin
    .from("deals")
    .insert({
      tenant_id: tenantId,
      pipeline_id: pipeline.dealPipelineId,
      stage_id: stageId,
      customer_id: clienteId,
      owner_id: ownerId,
      projeto_id: projetoId,
      title,
      value: proposta.valor_total ?? 0,
      status: dealStatus,
      origem: SOURCE,
    })
    .select("id")
    .single();

  if (dealErr || !deal?.id) {
    const message = dealErr?.message ?? "no id";
    const isDuplicate = dealErr?.code === "23505" || /duplicate key|unique constraint|uq_deal_projeto/i.test(message);
    if (isDuplicate) {
      const { data: existingDeal } = await admin
        .from("deals")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (existingDeal?.id) {
        const dealId = existingDeal.id as string;
        await admin.from("projetos").update({ deal_id: dealId }).eq("id", projetoId).eq("tenant_id", tenantId);
        if (proposta.id) {
          await admin.from("propostas_nativas").update({ deal_id: dealId }).eq("id", proposta.id).eq("tenant_id", tenantId);
        }
        return { dealId, created: false, reason: "projeto_duplicate_recovery" };
      }
    }
    return { dealId: null, created: false, reason: `insert_failed: ${message}` };
  }
  const dealId = deal.id as string;

  // Atualiza FKs (RB-58: confirmar com .select())
  const { data: updProj } = await admin
    .from("projetos")
    .update({ deal_id: dealId })
    .eq("id", projetoId)
    .select("id");
  if (!updProj || updProj.length === 0) {
    console.error(`[${MODULE}] createDealForProject: UPDATE projetos.deal_id afetou 0 linhas (id=${projetoId})`);
  }

  if (proposta.id) {
    const { data: updProp } = await admin
      .from("propostas_nativas")
      .update({ deal_id: dealId })
      .eq("id", proposta.id)
      .select("id");
    if (!updProp || updProp.length === 0) {
      console.error(`[${MODULE}] createDealForProject: UPDATE propostas_nativas.deal_id afetou 0 linhas (id=${proposta.id})`);
    }
  }

  // Multi-pipeline: inserir membership em pipelines secundários.
  // O trigger trg_sync_dps_kanban materializa cada linha em deal_kanban_projection.
  if (pipeline.secondaryPipelines.length > 0) {
    const dpsRows = pipeline.secondaryPipelines.map((sp) => ({
      tenant_id: tenantId,
      deal_id: dealId,
      pipeline_id: sp.pipelineId,
      stage_id: sp.stageId,
    }));
    const { error: dpsErr } = await admin
      .from("deal_pipeline_stages")
      .upsert(dpsRows, { onConflict: "deal_id,pipeline_id" });
    if (dpsErr) {
      console.error(`[${MODULE}] createDealForProject: secondary pipelines upsert failed: ${dpsErr.message}`);
    }
  }

  return { dealId, created: true };
}

async function backfillDealsForProjectsWithoutDeal(
  admin: SupabaseClient,
  state: RequestState,
  jobId: string,
  tenantId: string,
  defaultPipeline: PipelineResolution,
  consultorFallback: ConsultorResolution,
  limit: number,
): Promise<void> {
  const { data: projetos } = await admin
    .from("projetos")
    .select("id, cliente_id, consultor_id, codigo, external_id")
    .eq("tenant_id", tenantId)
    .in("external_source", [...LEGACY_SM_SOURCES])
    .is("deal_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  for (const projeto of (projetos ?? []) as AnyObj[]) {
    const projetoId = pickStr(projeto.id);
    const clienteId = pickStr(projeto.cliente_id);
    if (!projetoId || !clienteId) continue;

    const projectPipeline = await resolvePipelinePerProject(
      admin,
      tenantId,
      pickStr(projeto.external_id),
      defaultPipeline,
    );

    const { data: proposta } = await admin
      .from("propostas_nativas")
      .select("id, titulo, status")
      .eq("tenant_id", tenantId)
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const proposalRow = (proposta as AnyObj | null) ?? null;
    const { data: versao } = proposalRow?.id
      ? await admin
          .from("proposta_versoes")
          .select("valor_total")
          .eq("tenant_id", tenantId)
          .eq("proposta_id", proposalRow.id)
          .limit(1)
          .maybeSingle()
      : { data: null };
    const dealRes = await createDealForProject(
      admin,
      tenantId,
      projetoId,
      clienteId,
      pickStr(projeto.consultor_id) ?? consultorFallback.fallbackId,
      projectPipeline,
      {
        id: pickStr(proposalRow?.id),
        valor_total: pickNum((versao as AnyObj | null)?.valor_total),
        titulo: pickStr(proposalRow?.titulo) ?? pickStr(projeto.codigo),
        status: pickStr(proposalRow?.status) ?? "rascunho",
      },
    );

    if (dealRes.dealId && dealRes.created) {
      logEventBuffered(state, admin, {
        jobId,
        tenantId,
        severity: "info",
        step: "backfill.deal",
        status: "created",
        message: "Deal retroativamente criado para projeto migrado sem vínculo.",
        sourceEntityType: "projeto",
        sourceEntityId: projetoId,
        canonicalEntityType: "projeto",
        canonicalEntityId: projetoId,
        details: { deal_id: dealRes.dealId },
      });
    }
  }
}

// ─── Resolver de consultor (DA-40: sem hardcode; fallback "Escritório") ─────
interface ConsultorResolution {
  fallbackId: string | null; // "Consultor Escritório" do tenant (ou primeiro ativo)
  fallbackNome: string | null;
}

async function resolveConsultorFallback(
  admin: SupabaseClient,
  tenantId: string,
): Promise<ConsultorResolution> {
  // 1) Buscar "Escritório" (case-insensitive, qualquer variação: "Escritorio", "Consultor Escritório")
  const { data: escritorio } = await admin
    .from("consultores")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .ilike("nome", "%escrit%rio%")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (escritorio?.id) {
    return { fallbackId: escritorio.id as string, fallbackNome: (escritorio.nome as string) ?? null };
  }
  // 2) Fallback do fallback: primeiro consultor ativo do tenant
  const { data: anyConsultor } = await admin
    .from("consultores")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return {
    fallbackId: (anyConsultor?.id as string | undefined) ?? null,
    fallbackNome: (anyConsultor?.nome as string | undefined) ?? null,
  };
}

/**
 * Resolve consultor canônico para um projeto SM.
 * Prioridade (atualizada):
 *   1) Funil "Vendedores" do projeto → stage.name → sm_consultor_mapping
 *   2) responsible.name → match direto em consultores (por nome)
 *   3) (auxiliares) responsible.email exato + responsible.name via sm_consultor_mapping
 *   4) fallback "Escritório" (ou primeiro ativo)
 * Nunca retorna null se houver fallback configurado.
 */
async function resolveConsultorFromResponsible(
  admin: SupabaseClient,
  tenantId: string,
  responsibleName: string | null | undefined,
  responsibleEmail: string | null | undefined,
  fallback: ConsultorResolution,
  projectExtId: string | null | undefined,
): Promise<{ id: string | null; matched: "vendedores_funnel" | "name" | "email" | "mapping" | "fallback" | "none"; matchedNome: string | null }> {
  // ── PRIORIDADE 1: Funil "Vendedores" → stage.name → sm_consultor_mapping ──
  if (projectExtId) {
    const { data: funisRows } = await admin
      .from("sm_projeto_funis_raw")
      .select("payload")
      .eq("tenant_id", tenantId)
      .eq("payload->project->>id", projectExtId);

    const vendedoresFunil = (funisRows ?? []).find((r: AnyObj) => {
      const fname = String((r.payload as AnyObj)?.name ?? "").trim().toLowerCase();
      return fname === "vendedores";
    });
    const stageName = pickStr((vendedoresFunil?.payload as AnyObj)?.stage?.name);

    if (stageName) {
      const { data: mapping } = await admin
        .from("sm_consultor_mapping")
        .select("consultor_id, canonical_name, is_ex_funcionario")
        .eq("tenant_id", tenantId)
        .ilike("sm_name", stageName)
        .limit(1)
        .maybeSingle();

      if (mapping?.consultor_id) {
        const { data: mappedConsultor } = await admin
          .from("consultores")
          .select("id, nome")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .eq("id", mapping.consultor_id)
          .limit(1)
          .maybeSingle();
        if (mappedConsultor?.id) {
          return {
            id: mappedConsultor.id as string,
            matched: "vendedores_funnel",
            matchedNome: (mappedConsultor.nome as string) ?? (mapping.canonical_name as string) ?? null,
          };
        }
      }
      if (mapping?.is_ex_funcionario && fallback.fallbackId) {
        return { id: fallback.fallbackId, matched: "fallback", matchedNome: fallback.fallbackNome };
      }
    }
  }

  // ── PRIORIDADE 2: responsible.name → match EXATO (case-insensitive) por nome em consultores ──
  // IMPORTANTE: usamos comparação exata pós-query para evitar match parcial
  // (ex.: "Bruno Caetano" não pode bater em "BRUNO BANDEIRA").
  const name = (responsibleName ?? "").trim();
  if (name) {
    const sanitized = name.replace(/[%_]/g, "");
    const { data } = await admin
      .from("consultores")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .ilike("nome", sanitized)
      .limit(1)
      .maybeSingle();
    if (data?.id && (data.nome as string).toLowerCase().trim() === name.toLowerCase()) {
      return { id: data.id as string, matched: "name", matchedNome: (data.nome as string) ?? null };
    }
  }

  // ── Auxiliar: email exato do responsável ──
  const email = (responsibleEmail ?? "").trim().toLowerCase();
  if (email) {
    const { data } = await admin
      .from("consultores")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) return { id: data.id as string, matched: "email", matchedNome: (data.nome as string) ?? null };
  }

  // ── Auxiliar: responsible.name via sm_consultor_mapping ──
  if (name) {
    const { data: mapping } = await admin
      .from("sm_consultor_mapping")
      .select("consultor_id, canonical_name, is_ex_funcionario")
      .eq("tenant_id", tenantId)
      .ilike("sm_name", name)
      .limit(1)
      .maybeSingle();

    if (mapping?.consultor_id) {
      const { data: mappedConsultor } = await admin
        .from("consultores")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .eq("id", mapping.consultor_id)
        .limit(1)
        .maybeSingle();
      if (mappedConsultor?.id) {
        return {
          id: mappedConsultor.id as string,
          matched: "mapping",
          matchedNome: (mappedConsultor.nome as string) ?? (mapping.canonical_name as string) ?? null,
        };
      }
    }
    if (mapping?.is_ex_funcionario && fallback.fallbackId) {
      return { id: fallback.fallbackId, matched: "fallback", matchedNome: fallback.fallbackNome };
    }
  }

  // ── PRIORIDADE 3: Fallback Escritório ──
  if (fallback.fallbackId) {
    return { id: fallback.fallbackId, matched: "fallback", matchedNome: fallback.fallbackNome };
  }
  return { id: null, matched: "none", matchedNome: null };
}

// ─── Mapa canônico de status SM → status nativo (SSOT proposalState.ts) ─────
// Valores nativos válidos: rascunho | gerada | enviada | vista | aceita | recusada | expirada | cancelada
// Regra de negócio: acceptanceDate sempre tem prioridade máxima → "aceita".
const SM_STATUS_MAP: Record<string, string> = {
  draft: "rascunho",
  created: "rascunho",
  generated: "gerada",
  sent: "enviada",
  viewed: "enviada",      // regra de negócio: viewed conta como enviada (estágio "Proposta Enviada")
  accepted: "aceita",
  approved: "aceita",
  rejected: "recusada",
  expired: "expirada",
  cancelled: "cancelada",
  canceled: "cancelada",
};

/**
 * Mapeia status SM → status canônico nativo.
 * REGRA: se acceptanceDate existe no payload, força "aceita" (prioridade máxima),
 * mesmo que status venha como "generated" — registra inconsistência para log.
 */
function mapSmStatus(
  rawStatus: string | null | undefined,
  acceptanceDate?: string | null,
): { status: string; recognized: boolean; raw: string | null; inconsistent: boolean } {
  const raw = (rawStatus ?? "").trim();
  const hasAcceptance = !!(acceptanceDate && String(acceptanceDate).trim());

  if (hasAcceptance) {
    const mapped = raw ? SM_STATUS_MAP[raw.toLowerCase()] : undefined;
    const inconsistent = !!raw && mapped !== "aceita";
    return { status: "aceita", recognized: true, raw: raw || null, inconsistent };
  }

  if (!raw) return { status: "rascunho", recognized: false, raw: null, inconsistent: false };
  const mapped = SM_STATUS_MAP[raw.toLowerCase()];
  if (mapped) return { status: mapped, recognized: true, raw, inconsistent: false };
  return { status: "rascunho", recognized: false, raw, inconsistent: false };
}

// ─── Gate de elegibilidade ──────────────────────────────────────────────────
type EligibilityIssue = { code: string; message: string };
type EligibilityResult =
  | { status: "eligible"; issues: EligibilityIssue[] }
  | { status: "blocked"; issues: EligibilityIssue[] };

function validateEligibility(args: {
  rawCliente: AnyObj | null;
  rawProjeto: AnyObj;
  rawProposta: AnyObj;
  pipeline: PipelineResolution;
}): EligibilityResult {
  const issues: EligibilityIssue[] = [];
  const { rawCliente, rawProjeto, rawProposta, pipeline } = args;

  if (!rawCliente) {
    issues.push({ code: "CLIENT_MISSING", message: "Cliente não resolvido no staging." });
  } else {
    const norm = normalizeSmClient(rawCliente);
    if (!norm.external_id) issues.push({ code: "CLIENT_NO_EXTERNAL_ID", message: "Cliente sem id externo." });
    if (!norm.nome) issues.push({ code: "CLIENT_NO_NAME", message: "Cliente sem nome." });
    // RB-63: presença de contato é avaliada pelos DÍGITOS BRUTOS (não pelo formatado).
    // Telefones com 12-13 dígitos (placeholder "999..." ou ruído) são rejeitados pelo
    // formatter (fmtPhoneBR), mas ainda assim representam contato existente. Bloquear
    // somente quando o cliente realmente não tem nenhum dado bruto de contato.
    const hasPhone = !!(norm.telefone_digits && norm.telefone_digits.length > 0);
    const hasDoc = !!(norm.cpf_cnpj_digits && norm.cpf_cnpj_digits.length > 0);
    const hasEmail = !!norm.email;
    if (!hasPhone && !hasDoc && !hasEmail) {
      issues.push({ code: "CLIENT_NO_CONTACT", message: "Cliente sem telefone, e-mail ou CPF/CNPJ." });
    }
  }

  const projN = normalizeSmProject(rawProjeto);
  if (!projN.external_id) {
    issues.push({ code: "PROJECT_NO_EXTERNAL_ID", message: "Projeto sem id externo." });
  }

  const propN = normalizeSmProposal(rawProposta);
  if (!propN.external_id) {
    issues.push({ code: "PROPOSAL_NO_EXTERNAL_ID", message: "Proposta sem id externo." });
  }
  if (propN.valor_total == null || !(propN.valor_total > 0)) {
    issues.push({ code: "PROPOSAL_INVALID_TOTAL", message: "Proposta sem valor_total válido." });
  }

  const hasVariables = Array.isArray(propN.variables) && propN.variables.length > 0;
  const hasPricing = Array.isArray(propN.pricing_table) && propN.pricing_table.length > 0;
  if (!hasVariables && !hasPricing) {
    issues.push({ code: "SNAPSHOT_EMPTY", message: "Proposta sem variáveis nem pricing_table — snapshot inválido." });
  }

  if (pipeline.hasPipelineConfigured) {
    if (!pipeline.funilId) {
      issues.push({ code: "PIPELINE_UNRESOLVED", message: "Tenant tem pipelines mas o funil padrão não foi resolvido." });
    }
    if (!pipeline.etapaId) {
      issues.push({ code: "STAGE_UNRESOLVED", message: "Funil sem etapa inicial configurada (pipeline_stages)." });
    }
  }

  return issues.length > 0
    ? { status: "blocked", issues }
    : { status: "eligible", issues: [] };
}

// ─── Dry-Run: simulação sem grava em canônicos ───────────────────────────────
interface DryRunReport {
  total_candidatos: number;
  clientes_a_criar: number;
  projetos_a_criar: number;
  propostas_a_criar: number;
  distribuicaoPorPipeline: Record<string, number>;
  distribuicaoPorConsultor: Record<string, number>;
  distribuicaoPorStage: Record<string, number>;
  distribuicaoPorStatus: Record<string, number>;
  bloqueados: Array<{ tipo: string; external_id: string | null; motivos: string[] }>;
  warnings: Array<{ tipo: string; external_id: string | null; mensagem: string }>;
}

async function runDryRunReport(
  admin: SupabaseClient,
  tenantId: string,
  candidates: AnyObj[],
  pipeline: PipelineResolution,
  consultorFallback: ConsultorResolution,
  jobId: string | null = null,
): Promise<DryRunReport> {
  const report: DryRunReport = {
    total_candidatos: candidates.length,
    clientes_a_criar: 0,
    projetos_a_criar: 0,
    propostas_a_criar: 0,
    distribuicaoPorPipeline: {},
    distribuicaoPorConsultor: {},
    distribuicaoPorStage: {},
    distribuicaoPorStatus: {},
    bloqueados: [],
    warnings: [],
  };

  const incr = (bucket: Record<string, number>, key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1;
  };

  // ============================================================
  // PRÉ-CARREGAMENTO LEVE (apenas metadados pequenos)
  // Evita carregar 1.9k projetos + 1.9k clientes + 2.4k funis
  // de uma vez (que estourava o limite de memória de ~150MB).
  // ============================================================

  // Consultores ativos (~7 registros)
  const { data: consultores } = await admin
    .from("consultores")
    .select("id, nome")
    .eq("tenant_id", tenantId)
    .eq("ativo", true);
  const consultoresById = new Map<string, string>();
  const consultoresByNomeExato = new Map<string, string>();
  for (const c of (consultores ?? []) as AnyObj[]) {
    consultoresById.set(c.id as string, c.nome as string);
    consultoresByNomeExato.set(String(c.nome).trim().toLowerCase(), c.id as string);
  }

  // sm_consultor_mapping (~10 registros)
  const { data: consultorMap } = await admin
    .from("sm_consultor_mapping")
    .select("sm_name, consultor_id, is_ex_funcionario")
    .eq("tenant_id", tenantId);
  const smMappingByName = new Map<string, { consultor_id: string | null; is_ex: boolean }>();
  for (const m of (consultorMap ?? []) as AnyObj[]) {
    smMappingByName.set(
      String(m.sm_name ?? "").trim().toLowerCase(),
      {
        consultor_id: (m.consultor_id as string) ?? null,
        is_ex: !!m.is_ex_funcionario,
      },
    );
  }

  // sm_funil_pipeline_map (~6 registros)
  const { data: funilMap } = await admin
    .from("sm_funil_pipeline_map")
    .select("sm_funil_name, pipeline_id, role")
    .eq("tenant_id", tenantId);
  const auxPipelinesByName = new Map<string, { pipelineId: string | null; role: string | null }>();
  for (const m of (funilMap ?? []) as AnyObj[]) {
    const k = String(m.sm_funil_name ?? "").trim().toLowerCase();
    if (!k) continue;
    auxPipelinesByName.set(k, {
      pipelineId: (m.pipeline_id as string) ?? null,
      role: (m.role as string) ?? null,
    });
  }

  // Nomes dos pipelines (principal + auxiliares)
  const pipelineNomeCache = new Map<string, string>();
  const auxPipelineIds = Array.from(auxPipelinesByName.values())
    .map((v) => v.pipelineId)
    .filter((x): x is string => !!x);
  if (pipeline.funilId) auxPipelineIds.push(pipeline.funilId);
  if (auxPipelineIds.length > 0) {
    const { data: ps } = await admin
      .from("projeto_funis").select("id, nome").in("id", auxPipelineIds);
    for (const p of (ps ?? []) as AnyObj[]) {
      pipelineNomeCache.set(p.id as string, (p.nome as string) ?? "—");
    }
  }
  const pipelineComercialNome =
    (pipeline.funilId && pipelineNomeCache.get(pipeline.funilId)) || "Comercial";

  // Etapas (~30 registros)
  const { data: etapas } = await admin
    .from("projeto_etapas").select("id, nome");
  const etapasById = new Map<string, string>();
  for (const e of (etapas ?? []) as AnyObj[]) {
    etapasById.set(e.id as string, (e.nome as string) ?? "—");
  }

  // ============================================================
  // PROCESSAMENTO EM CHUNKS DE 200 CANDIDATOS
  // Carrega projetos/clientes/funis APENAS do chunk atual,
  // libera a memória entre chunks.
  // ============================================================
  const CHUNK_SIZE = 200;
  const clientesVistos = new Set<string>();
  const projetosVistos = new Set<string>();
  const totalChunks = Math.ceil(candidates.length / CHUNK_SIZE);

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

    console.error(
      `[sm-promote/dry-run] chunk ${chunkIndex}/${totalChunks} (${chunk.length} candidatos)`,
    );

    // Atualiza progresso do job (não bloqueante)
    if (jobId) {
      try {
        await admin
          .from("solarmarket_promotion_jobs")
          .update({
            items_processed: Math.min(i + CHUNK_SIZE, candidates.length),
            total_items: candidates.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      } catch (_e) {
        // não derruba o dry-run por falha no update de progresso
      }
    }

    // Carrega payload das propostas DESTE chunk (candidates traz só id/external_id no dry-run)
    const propExtIdsChunk = chunk
      .map((r) => String((r as AnyObj).external_id ?? ""))
      .filter((s) => s.length > 0);
    const propostaPayloadsByExtId = new Map<string, AnyObj>();
    if (propExtIdsChunk.length > 0) {
      const { data: propRows } = await admin
        .from("sm_propostas_raw")
        .select("external_id, payload")
        .eq("tenant_id", tenantId)
        .in("external_id", propExtIdsChunk);
      for (const p of (propRows ?? []) as AnyObj[]) {
        propostaPayloadsByExtId.set(String(p.external_id), (p.payload as AnyObj) ?? {});
      }
    }

    // IDs únicos de projetos deste chunk (a partir dos payloads recém-carregados)
    const projectExtIdsChunk = new Set<string>();
    for (const row of chunk) {
      const pl = propostaPayloadsByExtId.get(String((row as AnyObj).external_id)) ?? (row.payload as AnyObj) ?? {};
      const projId = pickStr(pl?.project?.id);
      if (projId) projectExtIdsChunk.add(projId);
    }

    // Projetos do chunk (~200 registros)
    const projetosMap = new Map<string, AnyObj>();
    if (projectExtIdsChunk.size > 0) {
      const { data } = await admin
        .from("sm_projetos_raw")
        .select("external_id, payload")
        .eq("tenant_id", tenantId)
        .in("external_id", Array.from(projectExtIdsChunk));
      for (const p of (data ?? []) as AnyObj[]) {
        projetosMap.set(String(p.external_id), p.payload as AnyObj);
      }
    }

    // Clientes do chunk
    const clienteExtIdsChunk = new Set<string>();
    for (const proj of projetosMap.values()) {
      const cliId = pickStr(proj?.client?.id);
      if (cliId) clienteExtIdsChunk.add(cliId);
    }
    const clientesMap = new Map<string, AnyObj>();
    if (clienteExtIdsChunk.size > 0) {
      const { data } = await admin
        .from("sm_clientes_raw")
        .select("external_id, payload")
        .eq("tenant_id", tenantId)
        .in("external_id", Array.from(clienteExtIdsChunk));
      for (const c of (data ?? []) as AnyObj[]) {
        clientesMap.set(String(c.external_id), c.payload as AnyObj);
      }
    }

    // Funis-de-projeto do chunk (filtrados por projectExtIds, em sub-chunks)
    const funisPorProjeto = new Map<string, AnyObj[]>();
    if (projectExtIdsChunk.size > 0) {
      const projectIdsArr = Array.from(projectExtIdsChunk);
      for (let j = 0; j < projectIdsArr.length; j += 100) {
        const subChunk = projectIdsArr.slice(j, j + 100);
        const { data } = await admin
          .from("sm_projeto_funis_raw")
          .select("payload")
          .eq("tenant_id", tenantId)
          .in("payload->project->>id", subChunk);
        for (const f of (data ?? []) as AnyObj[]) {
          const projId = pickStr((f.payload as AnyObj)?.project?.id);
          if (!projId) continue;
          const list = funisPorProjeto.get(projId) ?? [];
          list.push(f.payload as AnyObj);
          funisPorProjeto.set(projId, list);
        }
      }
    }

    // ── Loop em memória sobre o chunk ──
    for (const row of chunk) {
      const propostaPayload: AnyObj =
        propostaPayloadsByExtId.get(String((row as AnyObj).external_id)) ??
        ((row as AnyObj).payload as AnyObj) ?? {};
      const propExtId = resolveProposalSourceKey(row as AnyObj);
      const projectExtId = pickStr(propostaPayload.project?.id);

      if (!projectExtId) {
        report.bloqueados.push({
          tipo: "proposta",
          external_id: propExtId,
          motivos: ["SM_PROPOSAL_NO_PROJECT"],
        });
        continue;
      }

      const rawProjeto: AnyObj = projetosMap.get(projectExtId) ?? {
        id: projectExtId,
        name: propostaPayload.project?.name,
      };

      const clientExtId = pickStr(rawProjeto?.client?.id);
      let rawCliente: AnyObj | null = null;
      if (clientExtId) {
        rawCliente = clientesMap.get(clientExtId) ?? rawProjeto.client ?? null;
      } else {
        rawCliente = rawProjeto?.client ?? null;
      }

      const elig = validateEligibility({
        rawCliente, rawProjeto, rawProposta: propostaPayload, pipeline,
      });
      if (elig.status === "blocked") {
        report.bloqueados.push({
          tipo: "proposta",
          external_id: propExtId,
          motivos: elig.issues.map((i) => i.code),
        });
        continue;
      }

      if (clientExtId && !clientesVistos.has(clientExtId)) {
        clientesVistos.add(clientExtId);
        report.clientes_a_criar += 1;
      }

      if (!projetosVistos.has(projectExtId)) {
        projetosVistos.add(projectExtId);
        report.projetos_a_criar += 1;

        incr(report.distribuicaoPorPipeline, pipelineComercialNome);

        const funis = funisPorProjeto.get(projectExtId) ?? [];
        for (const f of funis) {
          const fname = String((f as AnyObj)?.name ?? "").trim();
          if (!fname) continue;
          if (fname.toLowerCase() === "vendedores") continue;
          if (fname.toLowerCase() === pipelineComercialNome.toLowerCase()) continue;
          const aux = auxPipelinesByName.get(fname.toLowerCase());
          if (aux?.pipelineId) {
            const nome = pipelineNomeCache.get(aux.pipelineId) ?? fname;
            incr(report.distribuicaoPorPipeline, nome);
          } else {
            report.warnings.push({
              tipo: "projeto",
              external_id: projectExtId,
              mensagem: `Funil "${fname}" sem mapeamento para pipeline nativo (deal adicional será omitido).`,
            });
          }
        }
      }

      report.propostas_a_criar += 1;

      const statusInfo = mapSmStatus(propostaPayload.status, propostaPayload.acceptanceDate);
      incr(report.distribuicaoPorStatus, statusInfo.status);

      const stageId = resolveStageForStatus(pipeline, statusInfo.status);
      if (stageId) {
        incr(report.distribuicaoPorStage, etapasById.get(stageId) ?? statusInfo.status);
      } else {
        incr(report.distribuicaoPorStage, "—");
      }

      const responsibleName = pickStr(rawProjeto?.responsible?.name);
      let consultorLabel = "";

      const funisProj = funisPorProjeto.get(projectExtId) ?? [];
      const vendedoresFunil = funisProj.find((f) =>
        String((f as AnyObj)?.name ?? "").trim().toLowerCase() === "vendedores"
      );
      if (vendedoresFunil) {
        const stageName = pickStr((vendedoresFunil as AnyObj)?.stage?.name);
        if (stageName) {
          const mapping = smMappingByName.get(stageName.trim().toLowerCase());
          if (mapping?.consultor_id) {
            const nome = consultoresById.get(mapping.consultor_id) ?? stageName;
            consultorLabel = `${nome} (Vendedores)`;
          } else if (mapping?.is_ex && consultorFallback.fallbackNome) {
            consultorLabel = `${consultorFallback.fallbackNome} (fallback)`;
          }
        }
      }

      if (!consultorLabel && responsibleName) {
        const cid = consultoresByNomeExato.get(responsibleName.trim().toLowerCase());
        if (cid) {
          consultorLabel = `${consultoresById.get(cid)} (responsible)`;
        }
      }

      if (!consultorLabel) {
        consultorLabel = `${consultorFallback.fallbackNome ?? "—"} (fallback)`;
      }

      incr(report.distribuicaoPorConsultor, consultorLabel);
    }

    // Libera a memória do chunk antes do próximo lote
    projetosMap.clear();
    clientesMap.clear();
    funisPorProjeto.clear();
    propostaPayloadsByExtId.clear();
  }

  return report;
}

// ─── Pipeline orquestrado por proposta ───────────────────────────────────────
type PromotionScope = "cliente" | "projeto" | "proposta";

async function promoteOneProposalRow(
  admin: SupabaseClient,
  state: RequestState,
  jobId: string,
  tenantId: string,
  rawProposalRow: AnyObj,
  pipeline: PipelineResolution,
  consultorFallback: ConsultorResolution,
  scope: PromotionScope = "proposta",
  clienteCache?: ClienteCache,
): Promise<"promoted" | "skipped" | "blocked" | "error"> {
  const propostaPayload: AnyObj = rawProposalRow.payload ?? {};
  const propExtId = resolveProposalSourceKey(rawProposalRow);
  if (!propExtId) {
    state.counters.errors++;
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "error", step: "validate", status: "error",
      message: "Proposta sem external_id no payload — pulada.",
      sourceEntityType: "proposta",
      errorCode: "SM_PROPOSAL_MISSING_ID",
    });
    return "error";
  }

  // 1) Resolver projeto e cliente do staging
  const projectExtId = pickStr(propostaPayload.project?.id);
  if (!projectExtId) {
    state.counters.skipped++;
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "warning", step: "resolve", status: "skipped",
      message: "Proposta sem project.id — não promovida.",
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      errorCode: "SM_PROPOSAL_NO_PROJECT",
    });
    return "skipped";
  }

  const { data: projRow } = await admin
    .from("sm_projetos_raw").select("payload")
    .eq("tenant_id", tenantId).eq("external_id", projectExtId).maybeSingle();
  const rawProjeto: AnyObj = projRow?.payload ?? { id: projectExtId, name: propostaPayload.project?.name };

  const clientExtId = pickStr(rawProjeto?.client?.id);
  let rawCliente: AnyObj | null = null;
  if (clientExtId) {
    const { data: cliRow } = await admin
      .from("sm_clientes_raw").select("payload")
      .eq("tenant_id", tenantId).eq("external_id", clientExtId).maybeSingle();
    rawCliente = cliRow?.payload ?? rawProjeto.client ?? null;
  } else {
    rawCliente = rawProjeto?.client ?? null;
  }
  if (!rawCliente) {
    state.counters.skipped++;
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "warning", step: "resolve", status: "skipped",
      message: "Proposta sem cliente vinculado no projeto — não promovida.",
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      errorCode: "SM_PROPOSAL_NO_CLIENT",
    });
    return "skipped";
  }

  // 2) GATE DE ELEGIBILIDADE — bloqueia antes de qualquer write canônico
  const elig = validateEligibility({ rawCliente, rawProjeto, rawProposta: propostaPayload, pipeline });
  if (elig.status === "blocked") {
    state.counters.blocked++;
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "error", step: "eligibility", status: "blocked",
      message: `Promoção bloqueada (${elig.issues.length} motivo(s)): ${elig.issues.map((i) => i.code).join(", ")}`,
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      errorCode: elig.issues[0]?.code ?? "BLOCKED",
      errorOrigin: MODULE,
      details: { issues: elig.issues },
    });
    return "blocked";
  }

  try {
    // 2) Cliente
    const cli = await promoteCliente(admin, tenantId, jobId, rawCliente, clienteCache);
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "info", step: "promote.cliente",
      status: cli.created ? "created" : "linked",
      message: cli.created ? "Cliente criado." : "Cliente já existia (link reutilizado).",
      sourceEntityType: "cliente", sourceEntityId: pickStr(rawCliente.id),
      canonicalEntityType: "cliente", canonicalEntityId: cli.id,
    });

    // Scope=cliente: encerra aqui sem criar projeto/proposta
    if (scope === "cliente") {
      state.counters.promoted++;
      return "promoted";
    }

    // 2.5) Resolver consultor a partir do responsável SM (com fallback "Escritório")
    const responsibleName = pickStr(rawProjeto?.responsible?.name);
    const responsibleEmail = pickStr(rawProjeto?.responsible?.email);
    const consultorRes = await resolveConsultorFromResponsible(
      admin, tenantId, responsibleName, responsibleEmail, consultorFallback, projectExtId,
    );
    if (consultorRes.matched === "fallback") {
      state.counters.warnings++;
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "warning", step: "resolve.consultor", status: "fallback",
        message: `Responsável SM "${responsibleName ?? responsibleEmail ?? "—"}" não encontrado; usando fallback "${consultorRes.matchedNome ?? "Escritório"}".`,
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        errorCode: "CONSULTOR_FALLBACK", errorOrigin: MODULE,
        details: { responsible_name: responsibleName, responsible_email: responsibleEmail, fallback_id: consultorRes.id },
      });
    } else if (consultorRes.matched === "none") {
      state.counters.warnings++;
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "warning", step: "resolve.consultor", status: "unresolved",
        message: "Nenhum consultor resolvido e nenhum fallback configurado para o tenant — projeto será criado sem consultor_id.",
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        errorCode: "CONSULTOR_UNRESOLVED", errorOrigin: MODULE,
      });
    }

    // 2.7) Mapear status SM → status nativo (precisa vir antes do projeto p/ resolver stage)
    const propNorm = normalizeSmProposal(propostaPayload);
    const statusInfo = mapSmStatus(propNorm.status_source, propNorm.accepted_at);
    if (!statusInfo.recognized && statusInfo.raw) {
      state.counters.warnings++;
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "warning", step: "map.status", status: "unrecognized",
        message: `Status SM "${statusInfo.raw}" não reconhecido — usando "rascunho".`,
        sourceEntityType: "proposta", sourceEntityId: propExtId,
        errorCode: "STATUS_UNRECOGNIZED", errorOrigin: MODULE,
        details: { raw_status: statusInfo.raw },
      });
    }
    if (statusInfo.inconsistent) {
      state.counters.warnings++;
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "warning", step: "map.status", status: "inconsistent",
        message: `Status SM "${statusInfo.raw}" + acceptanceDate presente — forçado para "aceita".`,
        sourceEntityType: "proposta", sourceEntityId: propExtId,
        errorCode: "STATUS_INCONSISTENT_WITH_ACCEPTANCE", errorOrigin: MODULE,
        details: { raw_status: statusInfo.raw, accepted_at: propNorm.accepted_at },
      });
    }

    // 2.8) Resolver pipeline POR PROJETO (usa sm_funil_pipeline_map quando existir).
    // Se nada estiver mapeado, cai no `pipeline` default (Comercial padrão).
    const pipelinePerProject = await resolvePipelinePerProject(
      admin, tenantId, projectExtId, pipeline,
    );

    // 3) Projeto (etapa resolvida pelo status canônico mapeado)
    // LOG OBRIGATÓRIO antes de promoteProjeto — prova que o fluxo não para no cliente
    const stageIdResolved = resolveStageForStatus(pipelinePerProject, statusInfo.status);
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "info", step: "promote_projeto_start", status: "started",
      message: "Iniciando promoção do projeto.",
      sourceEntityType: "projeto", sourceEntityId: projectExtId,
      details: {
        cliente_id: cli.id,
        consultor_id: consultorRes.id,
        funil_id: pipelinePerProject.funilId,
        etapa_id: stageIdResolved ?? pipelinePerProject.etapaId,
        deal_pipeline_id: pipelinePerProject.dealPipelineId,
        canonical_status: statusInfo.status,
      },
    });

    let proj: { id: string; created: boolean };
    try {
      proj = await promoteProjeto(
        admin, tenantId, jobId, rawProjeto, cli.id, pipelinePerProject, consultorRes.id, statusInfo.status,
      );
    } catch (projErr) {
      const projMsg = projErr instanceof Error ? projErr.message : String(projErr);
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "error", step: "promote_projeto_error", status: "error",
        message: projMsg,
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        errorCode: "PROJECT_PROMOTION_FAILED", errorOrigin: MODULE,
        details: {
          cliente_id: cli.id,
          consultor_id: consultorRes.id,
          funil_id: pipelinePerProject.funilId,
          etapa_id: stageIdResolved ?? pipelinePerProject.etapaId,
          canonical_status: statusInfo.status,
        },
      });
      throw projErr; // re-throw para o catch externo contabilizar como PROMOTE_FAILED
    }

    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "info", step: "promote_projeto_success",
      status: proj.created ? "created" : "linked",
      message: proj.created ? "Projeto criado." : "Projeto já existia (link reutilizado).",
      sourceEntityType: "projeto", sourceEntityId: projectExtId,
      canonicalEntityType: "projeto", canonicalEntityId: proj.id,
      details: {
        projeto_id: proj.id,
        consultor_id: consultorRes.id,
        consultor_match: consultorRes.matched,
        status_mapped: statusInfo.status,
      },
    });

    // Scope=projeto: encerra aqui sem criar proposta
    if (scope === "projeto") {
      state.counters.promoted++;
      return "promoted";
    }

    // 4) Snapshot canônico
    const snapshot = buildCanonicalSnapshot({
      cliente: normalizeSmClient(rawCliente),
      projeto: normalizeSmProject(rawProjeto),
      proposta: normalizeSmProposal(propostaPayload),
      rawClient: rawCliente,
      rawProject: rawProjeto,
      rawProposal: propostaPayload,
    });

    // 5) Proposta + versão
    const prop = await promoteProposta(admin, tenantId, jobId, propostaPayload, {
      clienteId: cli.id,
      projetoId: proj.id,
      snapshot,
      userId: state.userId,
      consultorId: consultorRes.id,
    });
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "info", step: "promote.proposta",
      status: prop.created ? "created" : "linked",
      message: prop.created ? "Proposta + versão criadas." : "Proposta já existia (versão garantida).",
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      canonicalEntityType: "proposta", canonicalEntityId: prop.propostaId,
      details: { versao_id: prop.versaoId, status_mapped: statusInfo.status, status_source: statusInfo.raw },
    });

    // 6) DEAL canônico (Comercial). Idempotente: se projeto já tem deal_id, reusa.
    //    Não-fatal: se falhar, log warning e segue (proposta+projeto já criados).
    try {
      const dealRes = await createDealForProject(
        admin, tenantId, proj.id, cli.id, consultorRes.id, pipelinePerProject,
        {
          id: prop.propostaId,
          valor_total: propNorm.valor_total,
          titulo: propNorm.nome,
          status: statusInfo.status,
        },
      );
      if (dealRes.dealId && dealRes.created) {
        logEventBuffered(state, admin, {
          jobId, tenantId, severity: "info", step: "promote.deal", status: "created",
          message: `Deal criado e vinculado ao projeto.`,
          sourceEntityType: "proposta", sourceEntityId: propExtId,
          canonicalEntityType: "projeto", canonicalEntityId: proj.id,
          details: { deal_id: dealRes.dealId, pipeline_id: pipelinePerProject.dealPipelineId },
        });
      } else if (dealRes.dealId && !dealRes.created) {
        // já existia: silencioso
      } else {
        state.counters.warnings++;
        logEventBuffered(state, admin, {
          jobId, tenantId, severity: "warning", step: "promote.deal", status: "skipped",
          message: `Deal não criado: ${dealRes.reason ?? "motivo desconhecido"}.`,
          sourceEntityType: "projeto", sourceEntityId: projectExtId,
          canonicalEntityType: "projeto", canonicalEntityId: proj.id,
          errorCode: "DEAL_NOT_CREATED", errorOrigin: MODULE,
          details: { reason: dealRes.reason, pipeline_id: pipelinePerProject.dealPipelineId },
        });
      }
    } catch (dealErr) {
      state.counters.warnings++;
      const dmsg = dealErr instanceof Error ? dealErr.message : String(dealErr);
      console.error(`[${MODULE}] createDealForProject error:`, dmsg);
      logEventBuffered(state, admin, {
        jobId, tenantId, severity: "warning", step: "promote.deal", status: "error",
        message: `Falha ao criar deal: ${dmsg}`,
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        canonicalEntityType: "projeto", canonicalEntityId: proj.id,
        errorCode: "DEAL_CREATE_FAILED", errorOrigin: MODULE,
      });
    }

    if (projectExtId) state.promotedProjectExternalIds.push(projectExtId);
    state.counters.promoted++;
    return "promoted";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.counters.errors++;
    logEventBuffered(state, admin, {
      jobId, tenantId, severity: "error", step: "promote", status: "error",
      message: msg,
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      errorCode: "PROMOTE_FAILED", errorOrigin: MODULE,
    });
    return "error";
  } finally {
    state.counters.processed++;
  }
}

// ─── Bootstrap de funis a partir do staging do SolarMarket ──────────────────
// REGRAS RB-61 / RB-65 / RB-73:
//   - NUNCA criar etapas hardcoded "Aguardando Documentação", "Aguardando Compra",
//     etc. Essas etapas inventadas não correspondem ao que existe no SM e fazem
//     o motor cair em fallback genérico, perdendo a posição real do projeto.
//   - O `projeto_funis`/`projeto_etapas` espelho DEVE replicar exatamente os
//     funis e etapas presentes em `sm_funis_raw` (nome, ordem, quantidade).
//   - Idempotente: só insere o que falta. Não renomeia nem apaga existentes
//     (preserva personalizações do usuário).
//   - Categoria padrão: última etapa = "ganho", demais = "aberto" (heurística
//     simples; usuário pode ajustar via UI depois).
async function ensureDefaultFunis(admin: SupabaseClient, tenantId: string): Promise<void> {
  // 1) Carrega TODOS os funis do staging
  const { data: smFunis, error: smErr } = await admin
    .from("sm_funis_raw")
    .select("payload")
    .eq("tenant_id", tenantId);
  if (smErr) {
    console.error(`[${MODULE}] ensureDefaultFunis: falha ao ler sm_funis_raw: ${smErr.message}`);
    return;
  }
  if (!smFunis || smFunis.length === 0) {
    console.warn(`[${MODULE}] ensureDefaultFunis: sm_funis_raw vazio para tenant ${tenantId}, nada a espelhar`);
    return;
  }

  // 2) Carrega funis já existentes no tenant (case-insensitive por nome)
  const { data: existing } = await admin
    .from("projeto_funis")
    .select("id, nome, ordem")
    .eq("tenant_id", tenantId);
  const existingByName = new Map<string, { id: string; ordem: number }>();
  let maxOrdem = 0;
  for (const f of (existing ?? []) as AnyObj[]) {
    existingByName.set(String(f.nome).trim().toLowerCase(), {
      id: f.id as string,
      ordem: (f.ordem as number) ?? 0,
    });
    if ((f.ordem as number) > maxOrdem) maxOrdem = f.ordem as number;
  }

  const { count: existingPipelinesCount } = await admin
    .from("pipelines")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const canBootstrapCommercialPipelines = (existingPipelinesCount ?? 0) === 0;

  const { data: existingMaps } = await admin
    .from("sm_funil_pipeline_map")
    .select("sm_funil_name, role, pipeline_id")
    .eq("tenant_id", tenantId);
  const mapByFunil = new Map(
    ((existingMaps ?? []) as AnyObj[]).map((m) => [String(m.sm_funil_name).trim().toLowerCase(), m]),
  );

  // 3) Para cada funil do SM: respeita ESTRITAMENTE o mapeamento manual.
  //    Funis ignorados (Pagamento/Compensação) ou fonte de consultor (Vendedores)
  //    não podem criar projeto_funis/projeto_etapas. Quando um funil SM aponta para
  //    um pipeline existente (ex.: LEAD → Comercial), o espelho de execução usa o
  //    NOME/STAGES do pipeline de destino — nunca o nome bruto do funil de origem.
  for (const row of smFunis as AnyObj[]) {
    const payload = (row.payload ?? {}) as AnyObj;
    const funilNome = String(payload.name ?? "").trim();
    if (!funilNome) continue;

    // Pula funil "Vendedores" — é mapa de consultores, não pipeline real
    if (funilNome.toLowerCase() === "vendedores") continue;

    const key = funilNome.toLowerCase();
    const mapAtual = mapByFunil.get(key);
    if (!mapAtual) continue;
    if (mapAtual?.role === "ignore" || mapAtual?.role === "vendedor_source") continue;

    const stagesRaw = Array.isArray(payload.stages) ? (payload.stages as AnyObj[]) : [];
    if (stagesRaw.length === 0) continue;

    // Ordena pelas ordens originais do SM
    let stagesOrdenadas = [...stagesRaw].sort(
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
    );

    let targetFunilNome = funilNome;
    if (mapAtual?.pipeline_id) {
      const { data: targetPipeline } = await admin
        .from("pipelines")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("id", mapAtual.pipeline_id as string)
        .maybeSingle();
      const pipelineName = pickStr((targetPipeline as AnyObj | null)?.name);
      if (!pipelineName) continue;
      targetFunilNome = pipelineName;

      const { data: targetStages } = await admin
        .from("pipeline_stages")
        .select("name, position")
        .eq("tenant_id", tenantId)
        .eq("pipeline_id", mapAtual.pipeline_id as string)
        .order("position", { ascending: true });
      if ((targetStages?.length ?? 0) > 0) {
        stagesOrdenadas = (targetStages ?? []).map((s: AnyObj) => ({ name: s.name, order: s.position }));
      }
    } else if (!canBootstrapCommercialPipelines) {
      continue;
    }

    const targetKey = targetFunilNome.toLowerCase();
    let funilId = existingByName.get(targetKey)?.id;

    if (!funilId) {
      maxOrdem += 1;
      const { data: created, error } = await admin
        .from("projeto_funis")
        .insert({
          tenant_id: tenantId,
          nome: targetFunilNome,
          ordem: maxOrdem,
          ativo: true,
        })
        .select("id")
        .single();
      if (error || !created?.id) {
        console.error(`[${MODULE}] ensureDefaultFunis falha em ${funilNome}:`, error?.message);
        continue;
      }
      funilId = created.id as string;
      existingByName.set(targetKey, { id: funilId, ordem: maxOrdem });
    }

    // 4) Etapas: replica o funil de destino autorizado. Só insere o que falta.
    const { data: stagesAtuais } = await admin
      .from("projeto_etapas")
      .select("nome, ordem")
      .eq("tenant_id", tenantId)
      .eq("funil_id", funilId);
    const stageNamesExistentes = new Set(
      (stagesAtuais ?? []).map((s: AnyObj) => String(s.nome).trim().toLowerCase()),
    );
    const ordemBase = (stagesAtuais ?? []).reduce(
      (max, s: AnyObj) => Math.max(max, Number(s.ordem) || 0),
      -1,
    );

    const toInsert: AnyObj[] = [];
    stagesOrdenadas.forEach((s, idx) => {
      const etapaNome = String(s?.name ?? "").trim();
      if (!etapaNome) return;
      if (stageNamesExistentes.has(etapaNome.toLowerCase())) return;
      const isLast = idx === stagesOrdenadas.length - 1;
      toInsert.push({
        tenant_id: tenantId,
        funil_id: funilId!,
        nome: etapaNome,
        ordem: ordemBase + 1 + idx,
        categoria: isLast ? "ganho" : "aberto",
      });
    });

    if (toInsert.length > 0) {
      const { error: insErr } = await admin.from("projeto_etapas").insert(toInsert);
      if (insErr) {
        console.error(`[${MODULE}] ensureDefaultFunis etapas ${funilNome}:`, insErr.message);
      }
    }

    // Se o tenant ainda não tem nenhum pipeline comercial, cria o espelho
    // pipelines/pipeline_stages/mapeamentos uma única vez. Se já houver pipeline,
    // respeita o mapeamento manual (RB-73) e não interfere.
    if (!canBootstrapCommercialPipelines || mapAtual?.role === "ignore" || mapAtual?.role === "vendedor_source" || mapAtual?.pipeline_id) {
      continue;
    }

    const { data: pipeline, error: pipeErr } = await admin
      .from("pipelines")
      .insert({
        tenant_id: tenantId,
        name: funilNome,
        is_active: true,
        kind: "process",
        papel: funilNome.toLowerCase().includes("engenharia") ? "engenharia" : "comercial",
      })
      .select("id")
      .single();
    if (pipeErr || !pipeline?.id) {
      console.error(`[${MODULE}] ensureDefaultFunis pipeline ${funilNome}:`, pipeErr?.message);
      continue;
    }

    const stageRows = stagesOrdenadas.map((s, idx) => ({
      tenant_id: tenantId,
      pipeline_id: pipeline.id,
      name: String(s?.name ?? "").trim() || `Etapa ${idx + 1}`,
      position: idx,
      probability: idx === stagesOrdenadas.length - 1 ? 100 : 50,
      is_closed: idx === stagesOrdenadas.length - 1,
      is_won: idx === stagesOrdenadas.length - 1,
    }));
    const { data: createdStages, error: stErr } = await admin
      .from("pipeline_stages")
      .insert(stageRows)
      .select("id, name");
    if (stErr || !createdStages || createdStages.length === 0) {
      console.error(`[${MODULE}] ensureDefaultFunis pipeline_stages ${funilNome}:`, stErr?.message);
      continue;
    }

    await admin.from("sm_etapa_stage_map").upsert(
      createdStages.map((stage: AnyObj, idx: number) => ({
        tenant_id: tenantId,
        sm_funil_name: funilNome,
        sm_etapa_name: stageRows[idx].name,
        stage_id: stage.id,
      })),
      { onConflict: "tenant_id,sm_funil_name,sm_etapa_name" },
    );
    await admin.from("sm_funil_pipeline_map").upsert(
      { tenant_id: tenantId, sm_funil_name: funilNome, role: "pipeline", pipeline_id: pipeline.id },
      { onConflict: "tenant_id,sm_funil_name" },
    );
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────
async function actionPromoteAll(
  admin: SupabaseClient,
  state: RequestState,
  payload: { batch_limit?: number; dry_run?: boolean; scope?: PromotionScope; skip_post_phases?: boolean },
): Promise<Response> {
  const tenantId = state.tenantId!;
  const userId: string | null = state.userId;
  const batchLimit = Math.min(
    Math.max(Number(payload.batch_limit ?? DEFAULT_BATCH_LIMIT), 1),
    MAX_BATCH_LIMIT,
  );
  const dryRun = Boolean(payload.dry_run);
  const skipPostPhases = Boolean(payload.skip_post_phases);
  const scope: PromotionScope =
    payload.scope === "cliente" || payload.scope === "projeto" ? payload.scope : "proposta";

  const jobId = await createJob(admin, tenantId, userId, "promote-all", {
    batch_limit: batchLimit,
    dry_run: dryRun,
    scope,
    skip_post_phases: skipPostPhases,
  });
  state.jobId = jobId;

  await patchJob(admin, jobId, {
    status: "running" satisfies JobStatus,
    started_at: new Date().toISOString(),
    last_step_at: new Date().toISOString(),
  });

  if (!dryRun) {
    try {
      await ensureDefaultFunis(admin, tenantId);
    } catch (e) {
      console.error(`[${MODULE}] ensureDefaultFunis falhou (não-fatal):`, (e as Error).message);
    }
  }

  const pipeline = await resolveDefaultPipeline(admin, tenantId);
  const consultorFallback = await resolveConsultorFallback(admin, tenantId);
  await backfillDealsForProjectsWithoutDeal(
    admin,
    state,
    jobId,
    tenantId,
    pipeline,
    consultorFallback,
    batchLimit,
  );
  await logEvent(admin, {
    jobId, tenantId, severity: "info", step: "init", status: "started",
    message: `promote-all iniciado (batch_limit=${batchLimit}, dry_run=${dryRun}, scope=${scope}, skip_post_phases=${skipPostPhases}); pipeline=${pipeline.funilId ?? "—"} etapa=${pipeline.etapaId ?? "—"} configured=${pipeline.hasPipelineConfigured}; consultor_fallback=${consultorFallback.fallbackNome ?? "—"}`,
  });

  const promotedIds = await fetchPromotedSourceIds(admin, tenantId, "proposta", "proposta");
  const selectCols = dryRun ? "id, external_id" : "id, external_id, payload";
  const promotedSet = new Set(promotedIds);
  const candidateMeta: AnyObj[] = [];
  const pageSize = 100;
  for (let from = 0; candidateMeta.length < batchLimit; from += pageSize) {
    const { data: pageRows, error: pageErr } = await admin
      .from("sm_propostas_raw")
      .select("id, external_id")
      .eq("tenant_id", tenantId)
      .order("imported_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (pageErr) {
      await patchJob(admin, jobId, {
        status: "failed", finished_at: new Date().toISOString(),
        error_summary: { fetch: pageErr.message },
      });
      return jsonResponse({ ok: false, job_id: jobId, error: pageErr.message }, 500);
    }
    for (const r of (pageRows ?? []) as AnyObj[]) {
      const sourceKey = resolveProposalSourceKey(r);
      if (!sourceKey || !promotedSet.has(sourceKey)) candidateMeta.push(r);
      if (candidateMeta.length >= batchLimit) break;
    }
    if (!pageRows || pageRows.length < pageSize) break;
  }

  let rows = candidateMeta;
  if (!dryRun && candidateMeta.length > 0) {
    const ids = candidateMeta.map((r) => r.id).filter(Boolean);
    const { data: payloadRows, error: payloadErr } = await admin
      .from("sm_propostas_raw")
      .select(selectCols)
      .eq("tenant_id", tenantId)
      .in("id", ids);
    if (payloadErr) {
      await patchJob(admin, jobId, {
        status: "failed", finished_at: new Date().toISOString(),
        error_summary: { fetch: payloadErr.message },
      });
      return jsonResponse({ ok: false, job_id: jobId, error: payloadErr.message }, 500);
    }
    const payloadById = new Map((payloadRows ?? []).map((r: AnyObj) => [r.id, r]));
    rows = candidateMeta.map((r) => payloadById.get(r.id) ?? r);
  }

  const candidates = rows ?? [];
  await patchJob(admin, jobId, { total_items: candidates.length });

  if (dryRun) {
    const report = await runDryRunReport(
      admin,
      tenantId,
      candidates as AnyObj[],
      pipeline,
      consultorFallback,
      jobId,
    );

    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "dry-run", status: "skipped",
      message: `dry_run=true: ${candidates.length} candidatos analisados, nada promovido. Bloqueados=${report.bloqueados.length}, warnings=${report.warnings.length}.`,
    });
    await patchJob(admin, jobId, {
      status: "completed" satisfies JobStatus,
      finished_at: new Date().toISOString(),
      items_processed: candidates.length,
      items_promoted: 0,
      items_skipped: candidates.length,
      items_with_warnings: report.warnings.length,
      items_with_errors: 0,
      items_blocked: report.bloqueados.length,
      metadata: { dry_run_report: report },
    });
    return jsonResponse({
      ok: true, job_id: jobId, status: "completed",
      dry_run: true, candidates: candidates.length,
      report,
    });
  }

  // ─── PERFORMANCE (Fase B): pré-busca cache de clientes existentes em UMA query ───
  // Antes: cada `promoteCliente` fazia 5 SELECTs de dedup (~250ms × N clientes).
  // Depois: 1 SELECT bulk no início + lookup em memória (Map) por cliente.
  // Cache é opcional — se prefetch falhar, `promoteCliente` cai no caminho normal.
  let clienteCache: ClienteCache | undefined;
  try {
    // Coleta external_ids de clientes referenciados por todas as propostas do batch.
    const projectExtIds = new Set<string>();
    for (const r of candidates as AnyObj[]) {
      const projId = pickStr((r.payload as AnyObj)?.project?.id);
      if (projId) projectExtIds.add(projId);
    }
    if (projectExtIds.size > 0) {
      // Carrega payloads de projetos (para extrair client.id) em sub-chunks de 200.
      const projIdArr = Array.from(projectExtIds);
      const clienteExtIds = new Set<string>();
      const rawClientesForCache: AnyObj[] = [];
      for (let j = 0; j < projIdArr.length; j += 200) {
        const sub = projIdArr.slice(j, j + 200);
        const { data: projRows } = await admin
          .from("sm_projetos_raw")
          .select("payload")
          .eq("tenant_id", tenantId)
          .in("external_id", sub);
        for (const p of (projRows ?? []) as AnyObj[]) {
          const cid = pickStr((p.payload as AnyObj)?.client?.id);
          if (cid) clienteExtIds.add(cid);
          // Inline client (alguns projetos trazem o cliente embutido)
          if ((p.payload as AnyObj)?.client) {
            rawClientesForCache.push((p.payload as AnyObj).client as AnyObj);
          }
        }
      }
      // Carrega payloads de sm_clientes_raw em sub-chunks de 200.
      const cliIdArr = Array.from(clienteExtIds);
      for (let j = 0; j < cliIdArr.length; j += 200) {
        const sub = cliIdArr.slice(j, j + 200);
        const { data: cliRows } = await admin
          .from("sm_clientes_raw")
          .select("payload")
          .eq("tenant_id", tenantId)
          .in("external_id", sub);
        for (const c of (cliRows ?? []) as AnyObj[]) {
          if (c.payload) rawClientesForCache.push(c.payload as AnyObj);
        }
      }
      clienteCache = await prefetchClienteCache(admin, tenantId, rawClientesForCache);
    }
  } catch (err) {
    // Falha no prefetch é não-fatal: cada promoteCliente faz fallback para SELECTs paralelos da Fase A.
    console.error(`[${MODULE}] prefetchClienteCache falhou (não-fatal):`, (err as Error).message);
    clienteCache = undefined;
  }

  // Modo seguro: processamento serial para evitar estouro de CPU e colisões de concorrência
  // durante a migração em massa. Velocidade menor, estabilidade maior.
  const PARALLEL_CHUNK = 1;
  for (let i = 0; i < candidates.length; i += PARALLEL_CHUNK) {
    if (i % SUBJOB_HEARTBEAT_EVERY === 0) {
      await patchJob(admin, jobId, { last_step_at: new Date().toISOString() });
    }
    const slice = candidates.slice(i, i + PARALLEL_CHUNK);
    await Promise.all(
      slice.map((row) =>
        promoteOneProposalRow(admin, state, jobId, tenantId, row, pipeline, consultorFallback, scope, clienteCache)
          .catch((err) => {
            console.error(`[${MODULE}] promoteOneProposalRow uncaught:`, (err as Error).message);
          }),
      ),
    );
    // Flush parcial entre batches para liberar buffer e dar visibilidade no UI.
    await flushLogs(state, admin);
  }
  // Flush final garante que nenhum log fique pendente.
  await flushLogs(state, admin);

  let finalStatus: JobStatus;
  if (state.counters.errors > 0) {
    finalStatus = "failed";
  } else if (state.counters.blocked > 0 && state.counters.promoted === 0) {
    finalStatus = "failed";
  } else if (state.counters.blocked > 0 || state.counters.warnings > 0 || state.counters.skipped > 0) {
    finalStatus = "completed_with_warnings";
  } else {
    finalStatus = "completed";
  }

  const basePatch: Parameters<typeof patchJob>[2] = {
    status: finalStatus,
    finished_at: new Date().toISOString(),
    last_step_at: new Date().toISOString(),
    items_processed: state.counters.processed,
    items_promoted: state.counters.promoted,
    items_skipped: state.counters.skipped,
    items_with_warnings: state.counters.warnings,
    items_with_errors: state.counters.errors,
    items_blocked: state.counters.blocked,
  };

  if (skipPostPhases || scope !== "proposta") {
    await patchJob(admin, jobId, basePatch);
    return jsonResponse({
      ok: true,
      job_id: jobId,
      status: finalStatus,
      counters: state.counters,
      post_phases_skipped: true,
      duration_ms: Date.now() - state.startedAt,
    });
  }

  await patchJob(admin, jobId, {
    ...basePatch,
    finished_at: null,
    metadata: {
      phases: {
        enrichment: { status: "running", processed: 0, versoes_updated: 0, ucs_inserted: 0 },
        custom_fields: { status: "pending", processed: 0, upserted: 0, files_downloaded: 0, files_failed: 0 },
      },
    },
  });
  const enrTotals = await runChainedPhase(admin, jobId, "sm-enrich-versoes", "enrich", { batch: 25, tenant_id: tenantId }, (r) => ({
    processed: r.processed ?? 0,
    versoes_updated: r.versoes_updated ?? 0,
    kit_itens_inserted: r.kit_itens_inserted ?? 0,
    ucs_inserted: r.ucs_inserted ?? 0,
    projetos_updated: r.projetos_updated ?? 0,
  }));

  await patchJob(admin, jobId, {
    metadata: {
      phases: {
        enrichment: { status: "completed", ...enrTotals },
        custom_fields: { status: "running", processed: 0, upserted: 0, files_downloaded: 0, files_failed: 0 },
      },
    },
  });
  const cfTotals = await runChainedPhase(admin, jobId, "sm-promote-custom-fields", "promote", { batch: 20, tenant_id: tenantId }, (r) => ({
    processed: r.processed ?? 0,
    upserted: r.upserted ?? 0,
    files_downloaded: r.files_downloaded ?? 0,
    files_skipped: r.files_skipped ?? 0,
    files_failed: r.files_failed ?? 0,
  }));

  await patchJob(admin, jobId, {
    ...basePatch,
    metadata: {
      phases: {
        custom_fields: { status: "completed", ...cfTotals },
        enrichment: { status: "completed", ...enrTotals },
      },
    },
  });

  return jsonResponse({
    ok: true,
    job_id: jobId,
    status: finalStatus,
    counters: state.counters,
    custom_fields: cfTotals,
    enrichment: enrTotals,
    duration_ms: Date.now() - state.startedAt,
  });
}

/**
 * Encadeia chamadas a uma edge interna (sm-promote-custom-fields ou sm-enrich-versoes)
 * em loop até next_offset === null. Acumula contadores e tolera falhas individuais
 * de chunk (loga em solarmarket_promotion_logs e segue).
 */
async function runChainedPhase(
  admin: SupabaseClient,
  jobId: string,
  fnName: string,
  action: string,
  basePayload: Record<string, unknown>,
  pickCounters: (r: any) => Record<string, number>,
): Promise<Record<string, number>> {
  const HARD_CAP_CHUNKS = 500;
  let offset = 0;
  const acc: Record<string, number> = {};
  const fnUrl = `${SUPABASE_URL}/functions/v1/${fnName}`;

  for (let i = 0; i < HARD_CAP_CHUNKS; i++) {
    let r: any;
    try {
      const resp = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ action, payload: { ...basePayload, offset } }),
      });
      r = await resp.json();
    } catch (e: any) {
      console.error(`[${MODULE}] chained ${fnName} fetch error:`, e?.message);
      break;
    }
    if (!r?.ok) {
      console.error(`[${MODULE}] chained ${fnName} returned not ok:`, r?.error);
      break;
    }
    const counters = pickCounters(r);
    for (const [k, v] of Object.entries(counters)) {
      acc[k] = (acc[k] ?? 0) + (v as number);
    }
    if (r.next_offset == null) break;
    offset = r.next_offset;
  }
  return acc;
}

async function actionCancelJob(
  admin: SupabaseClient,
  state: RequestState,
  payload: { job_id?: string; reason?: string },
): Promise<Response> {
  const tenantId = state.tenantId!;
  const jobId = payload.job_id;
  const reason = payload.reason ?? "Cancelado pelo usuário";
  if (!jobId) return jsonResponse({ ok: false, error: "job_id é obrigatório" }, 400);

  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .update({
      status: "cancelled" satisfies JobStatus,
      finished_at: new Date().toISOString(),
      error_summary: { cancel_reason: reason },
    })
    .eq("id", jobId).eq("tenant_id", tenantId)
    .in("status", ["pending", "running"])
    .select("id");
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  if (!data || data.length === 0) {
    return jsonResponse({ ok: false, error: "Job não cancelável (não encontrado ou em estado terminal)." }, 409);
  }
  await logEvent(admin, {
    jobId, tenantId, severity: "warning", step: "cancel", status: "cancelled",
    message: `Job cancelado: ${reason}`,
  });
  return jsonResponse({ ok: true, job_id: jobId, status: "cancelled" });
}

// ─── Entrypoint ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const state = createInitialState();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Método não permitido" }, 405);
    }
    // Lê body antes para conseguir extrair tenant_id em chamadas internas.
    const body = await req.json().catch(() => ({}));
    const internalTenantId =
      (body?.payload?.tenant_id as string | undefined) ??
      req.headers.get("x-sm-tenant-override");
    const ctx = await resolveUserContext(
      req.headers.get("Authorization"),
      req.headers.get("x-sm-internal-call"),
      internalTenantId,
    );
    if (!ctx) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);
    state.userId = ctx.userId;
    state.tenantId = ctx.tenantId;
    const action = String(body?.action ?? "");
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    const authHeader = req.headers.get("Authorization");
    const internalCallHeader = req.headers.get("x-sm-internal-call");

    switch (action) {
      case "promote-all":
        if (
          internalCallHeader !== "sm-migrate-chunk-v1" &&
          !Boolean(payload.dry_run) &&
          (payload.scope === undefined || payload.scope === "proposta") &&
          authHeader
        ) {
          return await delegateManualPromoteToChunked(authHeader);
        }
        return await actionPromoteAll(admin, state, payload as never);
      case "cancel-job":
        return await actionCancelJob(admin, state, payload as never);
      default:
        return jsonResponse({ ok: false, error: `Action inválida: ${action}` }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${MODULE}] Erro não tratado:`, message);
    if (state.jobId && state.tenantId) {
      try {
        await patchJob(admin, state.jobId, {
          status: "failed" satisfies JobStatus,
          finished_at: new Date().toISOString(),
          error_summary: { fatal: message },
        });
        await logEvent(admin, {
          jobId: state.jobId, tenantId: state.tenantId,
          severity: "error", step: "fatal", status: "error",
          message, errorCode: "UNHANDLED_EXCEPTION", errorOrigin: MODULE,
        });
      } catch (logErr) {
        console.error(`[${MODULE}] Falha ao registrar erro fatal:`, logErr);
      }
    }
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
