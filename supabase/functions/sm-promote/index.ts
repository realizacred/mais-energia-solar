// sm-promote: Motor canônico de promoção staging SolarMarket → CRM
// PR 3: pipeline real (cliente → projeto → proposta → versão) com normalizadores
// e snapshot canônico mínimo compatível com flattenSnapshot.
//
// Governança:
// - RB-57: sem `let` no escopo de módulo. Estado por request via createInitialState().
// - RB-58: UPDATEs críticos validam afetação com .select().
// - RB-23: sem console.log ativo (apenas console.error com prefixo do módulo).
// - DA-40: sem hardcode de pipeline/consultor — resolução por DB ou metadata.
// - SSOT idempotência: external_entity_links (source=solar_market).
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
...
async function findLink(
  admin: SupabaseClient,
  tenantId: string,
  sourceEntityType: string,
  sourceEntityId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("external_entity_links")
    .select("entity_id")
    .eq("tenant_id", tenantId)
    .eq("source", SOURCE)
    .eq("source_entity_type", sourceEntityType)
    .eq("source_entity_id", sourceEntityId)
    .maybeSingle();
  if (error) throw new Error(`findLink: ${error.message}`);
  return (data as { entity_id?: string } | null)?.entity_id ?? null;
}
...
async function fetchPromotedSourceIds(
  admin: SupabaseClient,
  tenantId: string,
  sourceEntityType: string,
): Promise<string[]> {
  const pageSize = 1000;
  const out: string[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("external_entity_links")
      .select("source_entity_id")
      .eq("tenant_id", tenantId)
      .eq("source", SOURCE)
      .eq("source_entity_type", sourceEntityType)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchPromotedSourceIds: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const v = (r as AnyObj).source_entity_id;
      if (typeof v === "string" && v.length) out.push(v);
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
...
  return {
    source: SOURCE,
    source_version: "v3",
    cliente: {
      nome: cliente.nome,
...
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
  const existing = await findLink(admin, tenantId, "cliente", norm.external_id);
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

  const existing = await findLink(admin, tenantId, "projeto", norm.external_id);
  if (existing) return { id: existing, created: false };

  const codigo = `SM-PROJ-${norm.external_id}`.slice(0, 32);
  const stageId = resolveStageForStatus(pipeline, canonicalStatus);
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

  const existing = await findLink(admin, tenantId, "proposta", norm.external_id);
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
      origem: SOURCE,
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
  if (pnErr || !pn?.id) throw new Error(`insert proposta: ${pnErr?.message}`);

  const versaoId = await insertVersao(admin, tenantId, pn.id as string, ctx.snapshot, norm, ctx.userId);

  await upsertLink(admin, tenantId, jobId, "proposta", pn.id as string, "proposta", norm.external_id, {
    versao_id: versaoId,
  });
  return { propostaId: pn.id as string, versaoId, created: true };
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
      status: "ativa",
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
  /** Mapa status canônico → stage_id (mapeamento por nome de stage). */
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
  const { data: anyPipe } = await admin
    .from("pipelines").select("id").eq("tenant_id", tenantId).limit(1);
  const hasPipelineConfigured = (anyPipe?.length ?? 0) > 0;
  if (!hasPipelineConfigured) {
    return { funilId: null, etapaId: null, hasPipelineConfigured: false, stageByStatus: {} };
  }

  // Prioridade 1: pipeline marcado como is_default (gerido por trigger no banco)
  const { data: pDefault } = await admin
    .from("pipelines").select("id")
    .eq("tenant_id", tenantId).eq("is_default", true).limit(1).maybeSingle();
  let funilId = (pDefault?.id as string | undefined);

  // Fallback 1: pipeline chamado "Comercial"
  if (!funilId) {
    const { data: pComercial } = await admin
      .from("pipelines").select("id, name")
      .eq("tenant_id", tenantId).ilike("name", "comercial").limit(1).maybeSingle();
    funilId = pComercial?.id as string | undefined;
  }

  // Fallback 2: primeiro pipeline criado
  if (!funilId) {
    const { data: pFirst } = await admin
      .from("pipelines").select("id").eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    funilId = pFirst?.id as string | undefined;
  }
  if (!funilId) return { funilId: null, etapaId: null, hasPipelineConfigured: true, stageByStatus: {} };

  const { data: stages } = await admin
    .from("pipeline_stages").select("id, name, position")
    .eq("tenant_id", tenantId).eq("pipeline_id", funilId)
    .order("position", { ascending: true });

  const list = (stages ?? []) as Array<{ id: string; name: string; position: number }>;
  const etapaId = list[0]?.id ?? null;

  // Construir mapa status → stage_id por match de nome (primeiro alias que casar).
  const stageByStatus: Record<string, string> = {};
  for (const [status, aliases] of Object.entries(STATUS_STAGE_NAME)) {
    const aliasesNorm = aliases.map(norm);
    const found = list.find((s) => aliasesNorm.includes(norm(s.name)));
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
 * Resolve consultor canônico a partir do responsável SM (nome/email).
 * Prioridade:
 *   1) match exato por email (consultores.email)
 *   2) match por nome normalizado (case/espaços-insensitive)
 *   3) fallback "Escritório" (ou primeiro ativo)
 * Nunca retorna null se houver fallback configurado.
 */
async function resolveConsultorFromResponsible(
  admin: SupabaseClient,
  tenantId: string,
  responsibleName: string | null | undefined,
  responsibleEmail: string | null | undefined,
  fallback: ConsultorResolution,
): Promise<{ id: string | null; matched: "email" | "name" | "fallback" | "none"; matchedNome: string | null }> {
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

// ─── Pipeline orquestrado por proposta ───────────────────────────────────────
async function promoteOneProposalRow(
  admin: SupabaseClient,
  state: RequestState,
  jobId: string,
  tenantId: string,
  rawProposalRow: AnyObj,
  pipeline: PipelineResolution,
  consultorFallback: ConsultorResolution,
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

    // 2.5) Resolver consultor a partir do responsável SM (com fallback "Escritório")
    const responsibleName = pickStr(rawProjeto?.responsible?.name);
    const responsibleEmail = pickStr(rawProjeto?.responsible?.email);
    const consultorRes = await resolveConsultorFromResponsible(
      admin, tenantId, responsibleName, responsibleEmail, consultorFallback,
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
    const proj = await promoteProjeto(
      admin, tenantId, jobId, rawProjeto, cli.id, pipeline, consultorRes.id, statusInfo.status,
    );
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "promote.projeto",
      status: proj.created ? "created" : "linked",
      message: proj.created ? "Projeto criado." : "Projeto já existia (link reutilizado).",
      sourceEntityType: "projeto", sourceEntityId: projectExtId,
      canonicalEntityType: "projeto", canonicalEntityId: proj.id,
      details: { consultor_id: consultorRes.id, consultor_match: consultorRes.matched, status_mapped: statusInfo.status },
    });

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
  payload: { batch_limit?: number; dry_run?: boolean },
): Promise<Response> {
  const tenantId = state.tenantId!;
  const userId = state.userId!;
  const batchLimit = Math.min(
    Math.max(Number(payload.batch_limit ?? DEFAULT_BATCH_LIMIT), 1),
    MAX_BATCH_LIMIT,
  );
  const dryRun = Boolean(payload.dry_run);

  const jobId = await createJob(admin, tenantId, userId, "promote-all", {
    batch_limit: batchLimit,
    dry_run: dryRun,
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
    message: `promote-all iniciado (batch_limit=${batchLimit}, dry_run=${dryRun}); pipeline=${pipeline.funilId ?? "—"} etapa=${pipeline.etapaId ?? "—"} configured=${pipeline.hasPipelineConfigured}; consultor_fallback=${consultorFallback.fallbackNome ?? "—"}`,
  });

  // Backlog: propostas raw que ainda não têm link canônico em external_entity_links.
  // Filtro obrigatório (escala): nunca reprocessar staging já promovido.
  const promotedIds = await fetchPromotedSourceIds(admin, tenantId, "proposta");
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
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "dry-run", status: "skipped",
      message: `dry_run=true: ${candidates.length} candidatos identificados, nada promovido.`,
    });
    await patchJob(admin, jobId, {
      status: "completed" satisfies JobStatus,
      finished_at: new Date().toISOString(),
      items_processed: 0, items_promoted: 0, items_skipped: candidates.length,
      items_with_warnings: 0, items_with_errors: 0, items_blocked: 0,
    });
    return jsonResponse({
      ok: true, job_id: jobId, status: "completed",
      dry_run: true, candidates: candidates.length,
    });
  }

  for (const row of candidates) {
    await promoteOneProposalRow(admin, state, jobId, tenantId, row, pipeline, consultorFallback);
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
