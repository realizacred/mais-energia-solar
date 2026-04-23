// sm-promote: Motor canônico de promoção staging SolarMarket → CRM
// v2026-04-21.2 — hardening etapa_id (FK projeto_etapas)
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

const SOURCE = "solarmarket";
const LEGACY_SM_SOURCES = [SOURCE, "solar_market"] as const;
const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

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

interface RequestState {
  startedAt: number;
  jobId: string | null;
  tenantId: string | null;
  userId: string | null;
  counters: {
    promoted: number;
    skipped: number;
    blocked: number;
    warnings: number;
    errors: number;
    processed: number;
  };
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
    counters: { promoted: 0, skipped: 0, blocked: 0, warnings: 0, errors: 0, processed: 0 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function resolveUserContext(authHeader: string | null) {
  if (!authHeader) return null;
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
  userId: string,
  jobType: string,
  filters: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .insert({
      tenant_id: tenantId,
      triggered_by: userId,
      trigger_source: "manual",
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
    const orphanLinkIds: string[] = [];
    for (const r of data) {
      const entityId = pickStr((r as AnyObj).entity_id);
      const sourceEntityId = pickStr((r as AnyObj).source_entity_id);
      const linkId = pickStr((r as AnyObj).id);
      if (!entityId || !sourceEntityId || !linkId) continue;
      if (await canonicalEntityExists(admin, tenantId, entityType, entityId)) {
        out.push(sourceEntityId);
      } else {
        orphanLinkIds.push(linkId);
      }
    }
    if (orphanLinkIds.length > 0) await cleanupOrphanLinks(admin, orphanLinkIds);
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

function normalizeSmClient(raw: AnyObj) {
  const c = raw?.client ?? raw ?? {};
  return {
    external_id: pickStr(c.id ?? raw.id),
    nome: pickStr(c.name ?? c.nome) ?? "Cliente sem nome",
    email: pickStr(c.email),
    telefone: onlyDigits(c.primaryPhone ?? c.phone ?? c.telefone) ?? "",
    cpf_cnpj: onlyDigits(c.cnpjCpf ?? c.cpfCnpj ?? c.cpf_cnpj),
    cep: onlyDigits(c.zipCode ?? c.cep),
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
  const valor_total = pricing.reduce(
    (acc: number, it: AnyObj) => acc + (pickNum(it.salesValue ?? it.totalValue) ?? 0),
    0,
  );
  return {
    external_id: pickStr(raw.id),
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
    const k = pickStr(v?.item);
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
      potencia_kwp: pickNum(smVars["Potência do Sistema (kWp)"] ?? smVars["potencia_kwp"]),
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
async function promoteCliente(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  rawCliente: AnyObj,
): Promise<{ id: string; created: boolean; matchedBy?: string }> {
  const norm = normalizeSmClient(rawCliente);
  if (!norm.external_id) throw new Error("Cliente SM sem id");

  const clienteCode = `SM-${norm.external_id}`.slice(0, 32);

  // 1) Link existente (idempotência canônica)
  const existing = await findLink(admin, tenantId, "cliente", norm.external_id, "cliente");
  if (existing) return { id: existing, created: false, matchedBy: "link" };

  // 2) Reconciliação por external_source + external_id (compatível com legado)
  const { data: byExt } = await admin
    .from("clientes")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("external_source", [...LEGACY_SM_SOURCES])
    .eq("external_id", norm.external_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byExt?.id) {
    await upsertLink(admin, tenantId, jobId, "cliente", byExt.id as string, "cliente", norm.external_id, { matched_by: "external_id" });
    return { id: byExt.id as string, created: false, matchedBy: "external_id" };
  }

  // 2.1) Reconciliação por cliente_code (protege reprocessamento após falha no link)
  const { data: byCode } = await admin
    .from("clientes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("cliente_code", clienteCode)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (byCode?.id) {
    await upsertLink(admin, tenantId, jobId, "cliente", byCode.id as string, "cliente", norm.external_id, { matched_by: "cliente_code" });
    return { id: byCode.id as string, created: false, matchedBy: "cliente_code" };
  }

  // 3) Reconciliação por CPF/CNPJ
  if (norm.cpf_cnpj) {
    const { data: byDoc } = await admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("cpf_cnpj", norm.cpf_cnpj)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byDoc?.id) {
      await upsertLink(admin, tenantId, jobId, "cliente", byDoc.id as string, "cliente", norm.external_id, { matched_by: "cpf_cnpj" });
      return { id: byDoc.id as string, created: false, matchedBy: "cpf_cnpj" };
    }
  }

  // 4) Reconciliação por telefone (evita uq_clientes_tenant_telefone)
  if (norm.telefone) {
    const { data: byPhone } = await admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("telefone_normalized", norm.telefone)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byPhone?.id) {
      await upsertLink(admin, tenantId, jobId, "cliente", byPhone.id as string, "cliente", norm.external_id, { matched_by: "telefone" });
      return { id: byPhone.id as string, created: false, matchedBy: "telefone" };
    }
  }

  // 5) Reconciliação por email
  if (norm.email) {
    const { data: byEmail } = await admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("email", norm.email)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) {
      await upsertLink(admin, tenantId, jobId, "cliente", byEmail.id as string, "cliente", norm.external_id, { matched_by: "email" });
      return { id: byEmail.id as string, created: false, matchedBy: "email" };
    }
  }

  // 6) Não existe — inserir novo
  const { data, error } = await admin
    .from("clientes")
    .insert({
      tenant_id: tenantId,
      cliente_code: clienteCode,
      nome: norm.nome,
      telefone: norm.telefone || "",
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
    if (/uq_clientes_tenant_cliente_code|duplicate key value/i.test(message)) {
      const { data: byConflict } = await admin
        .from("clientes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("cliente_code", clienteCode)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (byConflict?.id) {
        await upsertLink(admin, tenantId, jobId, "cliente", byConflict.id as string, "cliente", norm.external_id, { matched_by: "cliente_code_conflict" });
        return { id: byConflict.id as string, created: false, matchedBy: "cliente_code_conflict" };
      }
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
  };
  if (pipeline.funilId) insertPayload.funil_id = pipeline.funilId;
  if (stageId) insertPayload.etapa_id = stageId;
  if (consultorId) insertPayload.consultor_id = consultorId;

  const { data, error } = await admin
    .from("projetos")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`insert projeto: ${error?.message}`);

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
  return pipeline.stageByStatus[status] ?? pipeline.etapaId;
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

  // ── PRIORIDADE 2: responsible.name → match direto por nome em consultores ──
  const name = (responsibleName ?? "").trim();
  if (name) {
    const { data } = await admin
      .from("consultores")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .ilike("nome", name)
      .limit(1)
      .maybeSingle();
    if (data?.id) return { id: data.id as string, matched: "name", matchedNome: (data.nome as string) ?? null };
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
    if (!norm.telefone && !norm.cpf_cnpj && !norm.email) {
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

  const clientesVistos = new Set<string>();
  const projetosVistos = new Set<string>();

  // Pré-carrega nomes dos pipelines configurados (para distribuição legível)
  const pipelineNomeCache = new Map<string, string>();
  if (pipeline.funilId) {
    const { data: f } = await admin
      .from("projeto_funis").select("id, nome").eq("id", pipeline.funilId).maybeSingle();
    if (f?.nome) pipelineNomeCache.set(pipeline.funilId, f.nome as string);
  }
  // Mapa funil_sm → pipeline nativo (para deals adicionais)
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
  // Resolver nome amigável dos pipelines auxiliares
  const auxPipelineIds = Array.from(auxPipelinesByName.values())
    .map((v) => v.pipelineId)
    .filter((x): x is string => !!x);
  if (auxPipelineIds.length > 0) {
    const { data: ps } = await admin
      .from("projeto_funis").select("id, nome").in("id", auxPipelineIds);
    for (const p of (ps ?? []) as AnyObj[]) {
      pipelineNomeCache.set(p.id as string, (p.nome as string) ?? "—");
    }
  }
  const pipelineComercialNome =
    (pipeline.funilId && pipelineNomeCache.get(pipeline.funilId)) || "Comercial";

  for (const row of candidates) {
    const propostaPayload: AnyObj = (row.payload as AnyObj) ?? {};
    const propExtId = pickStr(propostaPayload.id) ?? (row.external_id as string | null);
    const projectExtId = pickStr(propostaPayload.project?.id);

    if (!projectExtId) {
      report.bloqueados.push({
        tipo: "proposta",
        external_id: propExtId,
        motivos: ["SM_PROPOSAL_NO_PROJECT"],
      });
      continue;
    }

    // Carrega projeto + cliente do staging
    const { data: projRow } = await admin
      .from("sm_projetos_raw").select("payload")
      .eq("tenant_id", tenantId).eq("external_id", projectExtId).maybeSingle();
    const rawProjeto: AnyObj = (projRow?.payload as AnyObj) ?? {
      id: projectExtId,
      name: propostaPayload.project?.name,
    };

    const clientExtId = pickStr(rawProjeto?.client?.id);
    let rawCliente: AnyObj | null = null;
    if (clientExtId) {
      const { data: cliRow } = await admin
        .from("sm_clientes_raw").select("payload")
        .eq("tenant_id", tenantId).eq("external_id", clientExtId).maybeSingle();
      rawCliente = (cliRow?.payload as AnyObj) ?? rawProjeto.client ?? null;
    } else {
      rawCliente = rawProjeto?.client ?? null;
    }

    // Gate de elegibilidade
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

    // Conta cliente novo (por external_id)
    if (clientExtId && !clientesVistos.has(clientExtId)) {
      clientesVistos.add(clientExtId);
      report.clientes_a_criar += 1;
    }
    // Conta projeto novo (por external_id)
    if (!projetosVistos.has(projectExtId)) {
      projetosVistos.add(projectExtId);
      report.projetos_a_criar += 1;

      // Pipeline principal (Comercial)
      incr(report.distribuicaoPorPipeline, pipelineComercialNome);

      // Pipelines auxiliares: olha funis vinculados ao projeto
      const { data: pjFunis } = await admin
        .from("sm_projeto_funis_raw").select("payload")
        .eq("tenant_id", tenantId)
        .eq("payload->project->>id", projectExtId);
      for (const r of (pjFunis ?? []) as AnyObj[]) {
        const fname = String(((r.payload as AnyObj)?.name ?? "")).trim();
        if (!fname) continue;
        if (fname.toLowerCase() === "vendedores") continue; // não vira deal
        if (pipeline.funilId && fname.toLowerCase() === (pipelineComercialNome.toLowerCase()))
          continue; // já contado
        const aux = auxPipelinesByName.get(fname.toLowerCase());
        if (aux?.pipelineId) {
          const nome = pipelineNomeCache.get(aux.pipelineId) ?? fname;
          incr(report.distribuicaoPorPipeline, nome);
        } else {
          // Funil sem mapeamento (warning apenas — não bloqueia)
          report.warnings.push({
            tipo: "projeto",
            external_id: projectExtId,
            mensagem: `Funil "${fname}" sem mapeamento para pipeline nativo (deal adicional será omitido).`,
          });
        }
      }
    }

    // Proposta sempre conta como nova (raw → propostas_nativas)
    report.propostas_a_criar += 1;

    // Status canônico
    const statusInfo = mapSmStatus(propostaPayload.status, propostaPayload.acceptanceDate);
    incr(report.distribuicaoPorStatus, statusInfo.status);

    // Stage resolvido
    const stageId = resolveStageForStatus(pipeline, statusInfo.status);
    if (stageId) {
      // tenta nome amigável
      const { data: stage } = await admin
        .from("projeto_etapas").select("nome").eq("id", stageId).maybeSingle();
      incr(report.distribuicaoPorStage, (stage?.nome as string) ?? statusInfo.status);
    } else {
      incr(report.distribuicaoPorStage, "—");
    }

    // Consultor (aplica nova hierarquia: Vendedores → responsible.name → fallback)
    const responsibleName = pickStr(rawProjeto?.responsible?.name);
    const responsibleEmail = pickStr(rawProjeto?.responsible?.email);
    const consultorRes = await resolveConsultorFromResponsible(
      admin, tenantId, responsibleName, responsibleEmail, consultorFallback, projectExtId,
    );
    let consultorLabel = consultorRes.matchedNome ?? "—";
    if (consultorRes.matched === "fallback") consultorLabel = `${consultorLabel} (fallback)`;
    if (consultorRes.matched === "name") consultorLabel = `${consultorLabel} (responsible)`;
    if (consultorRes.matched === "vendedores_funnel") consultorLabel = `${consultorLabel} (Vendedores)`;
    if (consultorRes.matched === "none") consultorLabel = "— (não resolvido)";
    incr(report.distribuicaoPorConsultor, consultorLabel);
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
): Promise<"promoted" | "skipped" | "blocked" | "error"> {
  const propostaPayload: AnyObj = rawProposalRow.payload ?? {};
  const propExtId = pickStr(propostaPayload.id) ?? rawProposalRow.external_id;
  if (!propExtId) {
    state.counters.errors++;
    await logEvent(admin, {
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
    await logEvent(admin, {
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
    await logEvent(admin, {
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
    await logEvent(admin, {
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
    const cli = await promoteCliente(admin, tenantId, jobId, rawCliente);
    await logEvent(admin, {
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
      await logEvent(admin, {
        jobId, tenantId, severity: "warning", step: "resolve.consultor", status: "fallback",
        message: `Responsável SM "${responsibleName ?? responsibleEmail ?? "—"}" não encontrado; usando fallback "${consultorRes.matchedNome ?? "Escritório"}".`,
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        errorCode: "CONSULTOR_FALLBACK", errorOrigin: MODULE,
        details: { responsible_name: responsibleName, responsible_email: responsibleEmail, fallback_id: consultorRes.id },
      });
    } else if (consultorRes.matched === "none") {
      state.counters.warnings++;
      await logEvent(admin, {
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
      await logEvent(admin, {
        jobId, tenantId, severity: "warning", step: "map.status", status: "unrecognized",
        message: `Status SM "${statusInfo.raw}" não reconhecido — usando "rascunho".`,
        sourceEntityType: "proposta", sourceEntityId: propExtId,
        errorCode: "STATUS_UNRECOGNIZED", errorOrigin: MODULE,
        details: { raw_status: statusInfo.raw },
      });
    }
    if (statusInfo.inconsistent) {
      state.counters.warnings++;
      await logEvent(admin, {
        jobId, tenantId, severity: "warning", step: "map.status", status: "inconsistent",
        message: `Status SM "${statusInfo.raw}" + acceptanceDate presente — forçado para "aceita".`,
        sourceEntityType: "proposta", sourceEntityId: propExtId,
        errorCode: "STATUS_INCONSISTENT_WITH_ACCEPTANCE", errorOrigin: MODULE,
        details: { raw_status: statusInfo.raw, accepted_at: propNorm.accepted_at },
      });
    }

    // 3) Projeto (etapa resolvida pelo status canônico mapeado)
    // LOG OBRIGATÓRIO antes de promoteProjeto — prova que o fluxo não para no cliente
    const stageIdResolved = resolveStageForStatus(pipeline, statusInfo.status);
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "promote_projeto_start", status: "started",
      message: "Iniciando promoção do projeto.",
      sourceEntityType: "projeto", sourceEntityId: projectExtId,
      details: {
        cliente_id: cli.id,
        consultor_id: consultorRes.id,
        funil_id: pipeline.funilId,
        etapa_id: stageIdResolved ?? pipeline.etapaId,
        canonical_status: statusInfo.status,
      },
    });

    let proj: { id: string; created: boolean };
    try {
      proj = await promoteProjeto(
        admin, tenantId, jobId, rawProjeto, cli.id, pipeline, consultorRes.id, statusInfo.status,
      );
    } catch (projErr) {
      const projMsg = projErr instanceof Error ? projErr.message : String(projErr);
      await logEvent(admin, {
        jobId, tenantId, severity: "error", step: "promote_projeto_error", status: "error",
        message: projMsg,
        sourceEntityType: "projeto", sourceEntityId: projectExtId,
        errorCode: "PROJECT_PROMOTION_FAILED", errorOrigin: MODULE,
        details: {
          cliente_id: cli.id,
          consultor_id: consultorRes.id,
          funil_id: pipeline.funilId,
          etapa_id: stageIdResolved ?? pipeline.etapaId,
          canonical_status: statusInfo.status,
        },
      });
      throw projErr; // re-throw para o catch externo contabilizar como PROMOTE_FAILED
    }

    await logEvent(admin, {
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
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "promote.proposta",
      status: prop.created ? "created" : "linked",
      message: prop.created ? "Proposta + versão criadas." : "Proposta já existia (versão garantida).",
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      canonicalEntityType: "proposta", canonicalEntityId: prop.propostaId,
      details: { versao_id: prop.versaoId, status_mapped: statusInfo.status, status_source: statusInfo.raw },
    });

    state.counters.promoted++;
    return "promoted";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.counters.errors++;
    await logEvent(admin, {
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

// ─── Actions ─────────────────────────────────────────────────────────────────
async function actionPromoteAll(
  admin: SupabaseClient,
  state: RequestState,
  payload: { batch_limit?: number; dry_run?: boolean; scope?: PromotionScope },
): Promise<Response> {
  const tenantId = state.tenantId!;
  const userId = state.userId!;
  const batchLimit = Math.min(
    Math.max(Number(payload.batch_limit ?? DEFAULT_BATCH_LIMIT), 1),
    MAX_BATCH_LIMIT,
  );
  const dryRun = Boolean(payload.dry_run);
  const scope: PromotionScope =
    payload.scope === "cliente" || payload.scope === "projeto" ? payload.scope : "proposta";

  const jobId = await createJob(admin, tenantId, userId, "promote-all", {
    batch_limit: batchLimit,
    dry_run: dryRun,
    scope,
  });
  state.jobId = jobId;

  await patchJob(admin, jobId, {
    status: "running" satisfies JobStatus,
    started_at: new Date().toISOString(),
  });

  // Resolve pipeline ANTES dos candidatos — falha rápido se o tenant tiver
  // pipeline configurado mas inconsistente (sem etapa).
  const pipeline = await resolveDefaultPipeline(admin, tenantId);
  const consultorFallback = await resolveConsultorFallback(admin, tenantId);
  await logEvent(admin, {
    jobId, tenantId, severity: "info", step: "init", status: "started",
    message: `promote-all iniciado (batch_limit=${batchLimit}, dry_run=${dryRun}, scope=${scope}); pipeline=${pipeline.funilId ?? "—"} etapa=${pipeline.etapaId ?? "—"} configured=${pipeline.hasPipelineConfigured}; consultor_fallback=${consultorFallback.fallbackNome ?? "—"}`,
  });

  // Backlog: propostas raw que ainda não têm link canônico em external_entity_links.
  // Filtro obrigatório (escala): nunca reprocessar staging já promovido.
  const promotedIds = await fetchPromotedSourceIds(admin, tenantId, "proposta", "proposta");
  let fetchQuery = admin
    .from("sm_propostas_raw")
    .select("id, external_id, payload")
    .eq("tenant_id", tenantId)
    .order("imported_at", { ascending: true })
    .limit(batchLimit);
  if (promotedIds.length > 0) {
    // PostgREST aceita lista em .not("col", "in", "(a,b,c)")
    const inList = `(${promotedIds.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(",")})`;
    fetchQuery = fetchQuery.not("external_id", "in", inList);
  }
  const { data: rows, error: fetchErr } = await fetchQuery;
  if (fetchErr) {
    await patchJob(admin, jobId, {
      status: "failed", finished_at: new Date().toISOString(),
      error_summary: { fetch: fetchErr.message },
    });
    return jsonResponse({ ok: false, job_id: jobId, error: fetchErr.message }, 500);
  }

  const candidates = rows ?? [];
  await patchJob(admin, jobId, { total_items: candidates.length });

  if (dryRun) {
    // Simulação completa: para cada candidato, resolve consultor + pipeline + stage
    // SEM executar nenhum INSERT/UPDATE em tabelas canônicas.
    const report = await runDryRunReport(
      admin,
      tenantId,
      candidates as AnyObj[],
      pipeline,
      consultorFallback,
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
      metadata: { dry_run_report: report } as never,
    });
    return jsonResponse({
      ok: true, job_id: jobId, status: "completed",
      dry_run: true, candidates: candidates.length,
      report,
    });
  }

  for (const row of candidates) {
    await promoteOneProposalRow(admin, state, jobId, tenantId, row, pipeline, consultorFallback, scope);
  }

  // Status final:
  // - errors>0  → failed
  // - blocked>0 sem nenhum promoted → failed (nada entrou íntegro)
  // - blocked>0 com promoted → completed_with_warnings
  // - warnings/skipped → completed_with_warnings
  // - tudo limpo → completed
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

  await patchJob(admin, jobId, {
    status: finalStatus,
    finished_at: new Date().toISOString(),
    items_processed: state.counters.processed,
    items_promoted: state.counters.promoted,
    items_skipped: state.counters.skipped,
    items_with_warnings: state.counters.warnings,
    items_with_errors: state.counters.errors,
    items_blocked: state.counters.blocked,
  });

  return jsonResponse({
    ok: true,
    job_id: jobId,
    status: finalStatus,
    counters: state.counters,
    duration_ms: Date.now() - state.startedAt,
  });
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
    const ctx = await resolveUserContext(req.headers.get("Authorization"));
    if (!ctx) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);
    state.userId = ctx.userId;
    state.tenantId = ctx.tenantId;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    switch (action) {
      case "promote-all":
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
