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

const SOURCE = "solar_market";
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
      trigger_source: "ui",
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
  const { error } = await admin.from("solarmarket_promotion_logs").insert({
    job_id: p.jobId,
    tenant_id: p.tenantId,
    severity: p.severity,
    step: p.step,
    status: p.status,
    message: p.message,
    source_entity_type: p.sourceEntityType ?? null,
    source_entity_id: p.sourceEntityId ?? null,
    canonical_entity_type: p.canonicalEntityType ?? null,
    canonical_entity_id: p.canonicalEntityId ?? null,
    error_code: p.errorCode ?? null,
    error_origin: p.errorOrigin ?? null,
    details: p.details ?? null,
  });
  if (error) console.error(`[${MODULE}] log fail:`, error.message);
}

// ─── Idempotência: external_entity_links (SSOT) ──────────────────────────────
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
}

// Lista os source_entity_id já promovidos para um tipo canônico no tenant.
// Usado para excluir staging já processado do batch de candidatos (escala).
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
): Promise<{ id: string; created: boolean }> {
  const norm = normalizeSmClient(rawCliente);
  if (!norm.external_id) throw new Error("Cliente SM sem id");

  const existing = await findLink(admin, tenantId, "cliente", norm.external_id);
  if (existing) return { id: existing, created: false };

  // Match secundário por external_source/external_id direto na tabela
  const { data: byExt } = await admin
    .from("clientes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_source", SOURCE)
    .eq("external_id", norm.external_id)
    .maybeSingle();
  if (byExt?.id) {
    await upsertLink(admin, tenantId, jobId, "cliente", byExt.id as string, "cliente", norm.external_id, { matched_by: "external_id" });
    return { id: byExt.id as string, created: false };
  }

  const cliente_code = `SM-${norm.external_id}`.slice(0, 32);
  const { data, error } = await admin
    .from("clientes")
    .insert({
      tenant_id: tenantId,
      cliente_code,
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
  if (error || !data?.id) throw new Error(`insert cliente: ${error?.message}`);

  await upsertLink(admin, tenantId, jobId, "cliente", data.id as string, "cliente", norm.external_id);
  return { id: data.id as string, created: true };
}

async function promoteProjeto(
  admin: SupabaseClient,
  tenantId: string,
  jobId: string,
  rawProjeto: AnyObj,
  clienteId: string,
): Promise<{ id: string; created: boolean }> {
  const norm = normalizeSmProject(rawProjeto);
  if (!norm.external_id) throw new Error("Projeto SM sem id");

  const existing = await findLink(admin, tenantId, "projeto", norm.external_id);
  if (existing) return { id: existing, created: false };

  // codigo único: SM-PROJ-<extId>
  const codigo = `SM-PROJ-${norm.external_id}`.slice(0, 32);
  const { data, error } = await admin
    .from("projetos")
    .insert({
      tenant_id: tenantId,
      cliente_id: clienteId,
      codigo,
      status: "lead", // status canônico inicial; reclassificação fica para PR posterior
      observacoes: norm.descricao,
    })
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
  ctx: { clienteId: string; projetoId: string; snapshot: AnyObj; userId: string | null },
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
  const statusMap: Record<string, string> = {
    approved: "aceita",
    accepted: "aceita",
    rejected: "recusada",
    sent: "enviada",
    draft: "rascunho",
    expired: "expirada",
  };
  const status = statusMap[(norm.status_source ?? "").toLowerCase()] ?? "rascunho";

  const { data: pn, error: pnErr } = await admin
    .from("propostas_nativas")
    .insert({
      tenant_id: tenantId,
      cliente_id: ctx.clienteId,
      projeto_id: ctx.projetoId,
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

// ─── Pipeline orquestrado por proposta ───────────────────────────────────────
async function promoteOneProposalRow(
  admin: SupabaseClient,
  state: RequestState,
  jobId: string,
  tenantId: string,
  rawProposalRow: AnyObj,
): Promise<"promoted" | "skipped" | "error"> {
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

    // 3) Projeto
    const proj = await promoteProjeto(admin, tenantId, jobId, rawProjeto, cli.id);
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "promote.projeto",
      status: proj.created ? "created" : "linked",
      message: proj.created ? "Projeto criado." : "Projeto já existia (link reutilizado).",
      sourceEntityType: "projeto", sourceEntityId: projectExtId,
      canonicalEntityType: "projeto", canonicalEntityId: proj.id,
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
    });
    await logEvent(admin, {
      jobId, tenantId, severity: "info", step: "promote.proposta",
      status: prop.created ? "created" : "linked",
      message: prop.created ? "Proposta + versão criadas." : "Proposta já existia (versão garantida).",
      sourceEntityType: "proposta", sourceEntityId: propExtId,
      canonicalEntityType: "proposta", canonicalEntityId: prop.propostaId,
      details: { versao_id: prop.versaoId },
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

  await logEvent(admin, {
    jobId, tenantId, severity: "info", step: "init", status: "started",
    message: `promote-all iniciado (batch_limit=${batchLimit}, dry_run=${dryRun})`,
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
      items_with_warnings: 0, items_with_errors: 0,
    });
    return jsonResponse({
      ok: true, job_id: jobId, status: "completed",
      dry_run: true, candidates: candidates.length,
    });
  }

  for (const row of candidates) {
    await promoteOneProposalRow(admin, state, jobId, tenantId, row);
  }

  const finalStatus: JobStatus = state.counters.errors > 0 || state.counters.warnings > 0 || state.counters.skipped > 0
    ? "completed_with_warnings"
    : "completed";

  await patchJob(admin, jobId, {
    status: finalStatus,
    finished_at: new Date().toISOString(),
    items_processed: state.counters.processed,
    items_promoted: state.counters.promoted,
    items_skipped: state.counters.skipped,
    items_with_warnings: state.counters.warnings,
    items_with_errors: state.counters.errors,
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
