// sm-promote: Motor canônico de promoção staging SolarMarket → CRM
// PR 2 da Fase 2. Apenas o motor base: jobs, logs, idempotência via external_entity_links.
// Não contém lógica de normalização/snapshot ainda (PR 3) nem reconciliação de arquivos (PR 4).
//
// Governança aplicada:
// - RB-57: sem `let` em escopo de módulo. Estado por request via createInitialState().
// - RB-58: UPDATEs críticos validam count > 0 ou usam .select().
// - RB-23: sem console.log ativo (apenas console.error com prefixo do módulo).
// - DA-40: nada de hardcode de negócio (consultores/pipelines).
// - Idempotência: SSOT em external_entity_links (UPSERT por origem).

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

// Constantes imutáveis (RB-57: const ok, let proibido)
const SOURCE_SYSTEM = "solar_market";
const DEFAULT_BATCH_LIMIT = 50;
const MAX_BATCH_LIMIT = 200;

type EntityType = "cliente" | "projeto" | "proposta" | "versao";
type LogSeverity = "info" | "warning" | "error";
type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "completed_with_errors"
  | "failed"
  | "cancelled";

interface RequestState {
  startedAt: number;
  jobId: string | null;
  tenantId: string | null;
  userId: string | null;
  counters: {
    promoted: number;
    warnings: number;
    errors: number;
    skipped: number;
  };
}

function createInitialState(): RequestState {
  return {
    startedAt: Date.now(),
    jobId: null,
    tenantId: null,
    userId: null,
    counters: { promoted: 0, warnings: 0, errors: 0, skipped: 0 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

async function resolveUserContext(
  authHeader: string | null,
): Promise<{ userId: string; tenantId: string; userClient: SupabaseClient } | null> {
  if (!authHeader) return null;
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return null;

  // Resolver tenant via RPC já existente do projeto (get_user_tenant_id)
  const { data: tenantId, error: tenantErr } = await userClient.rpc(
    "get_user_tenant_id",
  );
  if (tenantErr || !tenantId) return null;

  return { userId: userData.user.id, tenantId: tenantId as string, userClient };
}

// -----------------------------------------------------------------------------
// Jobs
// -----------------------------------------------------------------------------

async function createJob(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  jobType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .insert({
      tenant_id: tenantId,
      created_by: userId,
      job_type: jobType,
      status: "queued" satisfies JobStatus,
      payload,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`Falha ao criar job: ${error?.message ?? "sem id retornado"}`);
  }
  return data.id as string;
}

async function updateJobStatus(
  admin: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  // RB-58: UPDATE crítico → usar .select() para confirmar afetação
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .update(patch)
    .eq("id", jobId)
    .select("id");

  if (error) {
    throw new Error(`Falha ao atualizar job ${jobId}: ${error.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error(`Job ${jobId} não encontrado para atualização (0 linhas afetadas)`);
  }
}

async function logEvent(
  admin: SupabaseClient,
  params: {
    jobId: string;
    tenantId: string;
    severity: LogSeverity;
    stage: string;
    message: string;
    sourceTable?: string | null;
    sourceId?: string | null;
    entityType?: EntityType | null;
    entityId?: string | null;
    errorCode?: string | null;
    details?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { error } = await admin.from("solarmarket_promotion_logs").insert({
    job_id: params.jobId,
    tenant_id: params.tenantId,
    severity: params.severity,
    stage: params.stage,
    message: params.message,
    source_table: params.sourceTable ?? null,
    source_id: params.sourceId ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    error_code: params.errorCode ?? null,
    details: params.details ?? null,
  });
  if (error) {
    // Log não pode quebrar o motor — apenas registrar via console.error
    console.error(`[${MODULE}] Falha ao gravar log:`, error.message);
  }
}

// -----------------------------------------------------------------------------
// Idempotência (external_entity_links)
// -----------------------------------------------------------------------------

async function findExistingLink(
  admin: SupabaseClient,
  tenantId: string,
  entityType: EntityType,
  externalId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("external_entity_links")
    .select("entity_id")
    .eq("tenant_id", tenantId)
    .eq("source_system", SOURCE_SYSTEM)
    .eq("entity_type", entityType)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Falha ao consultar external_entity_links (${entityType}/${externalId}): ${error.message}`,
    );
  }
  return (data?.entity_id as string) ?? null;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

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

  // 1. Cria o job
  const jobId = await createJob(admin, tenantId, userId, "promote-all", {
    batch_limit: batchLimit,
    dry_run: dryRun,
  });
  state.jobId = jobId;

  // 2. Marca como running
  await updateJobStatus(admin, jobId, {
    status: "running" satisfies JobStatus,
    started_at: new Date().toISOString(),
  });

  await logEvent(admin, {
    jobId,
    tenantId,
    severity: "info",
    stage: "init",
    message: `Job promote-all iniciado (batch_limit=${batchLimit}, dry_run=${dryRun})`,
  });

  // 3. Conta candidatos elegíveis no staging
  // Nota: a seleção de elegibilidade fina entra no PR 3 (normalizadores).
  // Aqui apenas reportamos o backlog para o operador.
  const { count: totalRaw, error: countErr } = await admin
    .from("sm_propostas_raw")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countErr) {
    await logEvent(admin, {
      jobId,
      tenantId,
      severity: "error",
      stage: "discover",
      message: `Falha ao contar staging: ${countErr.message}`,
      errorCode: "STAGING_COUNT_FAILED",
    });
    await updateJobStatus(admin, jobId, {
      status: "failed" satisfies JobStatus,
      finished_at: new Date().toISOString(),
      error_message: countErr.message,
    });
    return jsonResponse({ ok: false, job_id: jobId, error: countErr.message }, 500);
  }

  await logEvent(admin, {
    jobId,
    tenantId,
    severity: "info",
    stage: "discover",
    message: `Backlog identificado em sm_propostas_raw: ${totalRaw ?? 0}`,
    details: { total_raw: totalRaw ?? 0, batch_limit: batchLimit },
  });

  // 4. Aviso explícito: motor de promoção real entra no PR 3.
  // Nesta versão (PR 2) o job é marcado como completed sem promover registros,
  // garantindo que não exista falso sucesso (counters zerados e mensagem clara).
  await logEvent(admin, {
    jobId,
    tenantId,
    severity: "warning",
    stage: "promote",
    message:
      "Motor de promoção (parser + snapshot canônico) será habilitado no PR 3. Nenhuma entidade promovida nesta execução.",
    errorCode: "PROMOTION_ENGINE_NOT_READY",
  });
  state.counters.warnings += 1;

  const finalStatus: JobStatus = "completed_with_warnings";
  await updateJobStatus(admin, jobId, {
    status: finalStatus,
    finished_at: new Date().toISOString(),
    items_promoted: state.counters.promoted,
    items_with_warnings: state.counters.warnings,
    items_with_errors: state.counters.errors,
    items_skipped: state.counters.skipped,
  });

  return jsonResponse({
    ok: true,
    job_id: jobId,
    status: finalStatus,
    counters: state.counters,
    backlog: { sm_propostas_raw: totalRaw ?? 0 },
    duration_ms: Date.now() - state.startedAt,
  });
}

async function actionProcessPromoteJob(
  admin: SupabaseClient,
  state: RequestState,
  payload: { job_id?: string },
): Promise<Response> {
  const tenantId = state.tenantId!;
  const jobId = payload.job_id;

  if (!jobId) {
    return jsonResponse({ ok: false, error: "job_id é obrigatório" }, 400);
  }

  // Valida que o job existe e pertence ao tenant
  const { data: job, error: jobErr } = await admin
    .from("solarmarket_promotion_jobs")
    .select("id, tenant_id, status")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (jobErr) {
    return jsonResponse({ ok: false, error: jobErr.message }, 500);
  }
  if (!job) {
    return jsonResponse({ ok: false, error: "Job não encontrado" }, 404);
  }
  if (job.status === "cancelled" || job.status === "failed") {
    return jsonResponse({
      ok: false,
      error: `Job em status terminal: ${job.status}`,
    }, 409);
  }

  state.jobId = jobId;

  await logEvent(admin, {
    jobId,
    tenantId,
    severity: "info",
    stage: "process",
    message:
      "process-promote-job invocado. Pipeline real (cliente → projeto → proposta → versão) entra no PR 3.",
  });

  // PR 2: noop estruturado, sem promoção, sem falso sucesso.
  return jsonResponse({
    ok: true,
    job_id: jobId,
    status: job.status,
    note: "PR 2: handler registrado. Pipeline canônico será implementado no PR 3.",
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

  if (!jobId) {
    return jsonResponse({ ok: false, error: "job_id é obrigatório" }, 400);
  }

  // RB-58: UPDATE crítico com .select() e filtro de status terminal
  const { data, error } = await admin
    .from("solarmarket_promotion_jobs")
    .update({
      status: "cancelled" satisfies JobStatus,
      finished_at: new Date().toISOString(),
      error_message: reason,
    })
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .in("status", ["queued", "running"])
    .select("id");

  if (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
  if (!data || data.length === 0) {
    return jsonResponse({
      ok: false,
      error: "Job não encontrado, já finalizado ou de outro tenant.",
    }, 409);
  }

  await logEvent(admin, {
    jobId,
    tenantId,
    severity: "warning",
    stage: "cancel",
    message: `Job cancelado: ${reason}`,
  });

  return jsonResponse({ ok: true, job_id: jobId, status: "cancelled" });
}

// -----------------------------------------------------------------------------
// Entrypoint
// -----------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // RB-57: estado por request
  const state = createInitialState();
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Método não permitido" }, 405);
    }

    const ctx = await resolveUserContext(req.headers.get("Authorization"));
    if (!ctx) {
      return jsonResponse({ ok: false, error: "Não autenticado" }, 401);
    }
    state.userId = ctx.userId;
    state.tenantId = ctx.tenantId;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const payload = (body?.payload ?? {}) as Record<string, unknown>;

    // Touch helper para evitar warning de variável não usada (idempotência).
    // findExistingLink será consumida no PR 3.
    void findExistingLink;

    switch (action) {
      case "promote-all":
        return await actionPromoteAll(admin, state, payload as never);
      case "process-promote-job":
        return await actionProcessPromoteJob(admin, state, payload as never);
      case "cancel-job":
        return await actionCancelJob(admin, state, payload as never);
      default:
        return jsonResponse(
          { ok: false, error: `Action inválida: ${action}` },
          400,
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${MODULE}] Erro não tratado:`, message);

    // Tenta marcar o job como failed se existir
    if (state.jobId && state.tenantId) {
      try {
        await updateJobStatus(admin, state.jobId, {
          status: "failed" satisfies JobStatus,
          finished_at: new Date().toISOString(),
          error_message: message,
        });
        await logEvent(admin, {
          jobId: state.jobId,
          tenantId: state.tenantId,
          severity: "error",
          stage: "fatal",
          message,
          errorCode: "UNHANDLED_EXCEPTION",
        });
      } catch (logErr) {
        console.error(`[${MODULE}] Falha ao registrar erro fatal:`, logErr);
      }
    }

    return jsonResponse({ ok: false, error: message }, 500);
  }
});
