// sm-migrate-chunk: Migração SolarMarket em chunks COM auto-encadeamento background.
//
// Arquitetura (revista):
//   - action=start  → cria job mestre + agenda 1º step via EdgeRuntime.waitUntil
//                     (returns 202 imediatamente; loop continua sem aba aberta)
//   - action=step   → processa 1 chunk via sm-promote(batch=25, scope=proposta)
//                     no fim, se has_more, auto-encadeia o próximo step via fetch
//                     (não-bloqueante via EdgeRuntime.waitUntil)
//   - action=continue → retoma um job existente (botão "Continuar" da UI)
//   - action=cron_resume → chamado por pg_cron quando job ficou stuck >2min
//                     (sem JWT de usuário; usa header secreto + tenant do job)
//   - action=cancel → marca job como cancelled (interrompe a cadeia)
//   - action=status → consulta job mestre + histórico
//
// Idempotência: cada step pergunta o backlog antes/depois. Se nada avançou,
// marca job como failed para não loopar infinito.
//
// Governança:
//   - RB-04 / RB-23 / RB-57 / RB-58 respeitados.
//   - Service role só para criar/ler/atualizar job mestre e disparar fetch encadeado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MODULE = "sm-migrate-chunk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sm-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = "sm-resume-cron-v1"; // mesmo string usado em sm_resume_stuck_migrations

const SOURCE_LIST = ["solarmarket", "solar_market"] as const;
const CHUNK_BATCH = 25;
const MIN_CHUNK_BATCH = 5;
const SELF_URL = `${SUPABASE_URL}/functions/v1/sm-migrate-chunk`;

function isGatewayTimeoutLike(error: string | undefined): boolean {
  const message = String(error ?? "").toLowerCase();
  return message.includes("http 546")
    || message.includes("cpu time exceeded")
    || message.includes("exceeded cpu")
    || message.includes("worker limit")
    || message.includes("http 504")
    || message.includes("gateway timeout")
    || message.includes("statement timeout")
    || message.includes("canceling statement due to statement timeout")
    || message.includes("connection closed before message completed");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

async function countBacklog(
  admin: any,
  tenantId: string,
): Promise<number> {
  const { count: total } = await admin
    .from("sm_propostas_raw")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  // Só considera proposta realmente concluída quando existe no CRM E já tem deal_id.
  // Links órfãos/antigos em external_entity_links não podem zerar o backlog,
  // senão o job marca "completed" enquanto a UI ainda mostra pendentes.
  const { count: promotedWithDeal } = await admin
    .from("propostas_nativas")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .in("external_source", [...SOURCE_LIST])
    .not("deal_id", "is", null);
  return Math.max(0, (total ?? 0) - (promotedWithDeal ?? 0));
}

/**
 * Dispara o próximo step em background. Não aguarda resposta.
 * Usado tanto por start quanto pelo final de cada step (auto-encadeamento).
 */
async function scheduleNextStep(masterJobId: string, tenantId: string): Promise<void> {
  // Usa fetch sem await em waitUntil para que o response atual já tenha sido enviado.
  try {
    await fetch(SELF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sm-cron-secret": CRON_SECRET,
      },
      body: JSON.stringify({
        action: "cron_resume",
        payload: { master_job_id: masterJobId, tenant_id: tenantId },
      }),
    });
  } catch (e) {
    console.error(`[${MODULE}] scheduleNextStep falhou:`, e);
  }
}

/**
 * Invoca sm-promote (modo real) usando service role (precisa funcionar no caminho cron_resume,
 * onde não temos JWT de usuário). Passa tenant_id explícito via header customizado.
 */
async function callSmPromoteOnce(
  tenantId: string,
  batchLimit: number,
  skipPostPhases = true,
): Promise<{
  ok: boolean;
  job_id?: string;
  status?: string;
  counters?: Record<string, number>;
  error?: string;
}> {
  const url = `${SUPABASE_URL}/functions/v1/sm-promote`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "x-sm-tenant-override": tenantId,
        "x-sm-internal-call": "sm-migrate-chunk-v1",
      },
      body: JSON.stringify({
        action: "promote-all",
        payload: {
          batch_limit: batchLimit,
          dry_run: false,
          scope: "proposta",
          tenant_id: tenantId,
          skip_post_phases: skipPostPhases,
        },
      }),
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
    };
  }
  return body as {
    ok: boolean;
    job_id?: string;
    status?: string;
    counters?: Record<string, number>;
  };
}

async function runAdaptivePromoteChunk(
  admin: any,
  tenantId: string,
): Promise<{
  ok: boolean;
  batch_used?: number;
  job_id?: string;
  status?: string;
  counters?: Record<string, number>;
  error?: string;
}> {
  const attempts = [CHUNK_BATCH].filter((value, index, arr) => arr.indexOf(value) === index);

  for (const batch of attempts) {
    const result = await callSmPromoteOnce(tenantId, batch, true);
    if (result.ok) {
      return {
        ok: true,
        batch_used: batch,
        job_id: result.job_id,
        status: result.status,
        counters: result.counters,
      };
    }

    if (!isGatewayTimeoutLike(result.error) || batch === MIN_CHUNK_BATCH) {
      return { ok: false, batch_used: batch, error: result.error };
    }

    try {
      await admin
        .from("solarmarket_promotion_logs")
        .insert({
          tenant_id: tenantId,
          job_id: null,
          severity: "warning",
          step: "adaptive-batch",
          status: "warning",
          message: `Chunk ${batch} excedeu limite de CPU/timeout; reduzindo lote automaticamente.`,
          source_entity_type: "job",
          source_entity_id: tenantId,
          canonical_entity_type: null,
          canonical_entity_id: null,
          error_code: "WORKER_LIMIT_RETRY",
          error_origin: MODULE,
          details: { attempted_batch: batch, next_batch: Math.max(MIN_CHUNK_BATCH, Math.floor(batch / 2)) },
        });
    } catch {
      // não bloqueia a recuperação adaptativa por falha de log
    }
  }

  return { ok: false, error: "Falha ao processar chunk adaptativo" };
}

/**
 * Lógica do step (extraída para ser chamada tanto por user quanto por cron).
 * Retorna { has_more, counters, error } SEM montar Response.
 */
async function processStep(
  admin: any,
  tenantId: string,
  masterJobId: string,
): Promise<{
  ok: boolean;
  has_more: boolean;
  backlog_remaining: number;
  counters?: Record<string, number>;
  last_chunk?: Record<string, number>;
  error?: string;
  finished?: boolean;
}> {
  // Verifica job ainda ativo
  const { data: masterRaw, error: masterErr } = await admin
    .from("solarmarket_promotion_jobs")
    .select(
      "id, status, total_items, items_processed, items_promoted, items_with_errors, items_with_warnings, items_blocked, items_skipped, metadata",
    )
    .eq("id", masterJobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  // Cast: typecheck estrito do supabase-js v2 retorna campos como `{}`.
  // Os tipos reais no banco são number/string/jsonb.
  const master = masterRaw as any;

  if (masterErr || !master) {
    return { ok: false, has_more: false, backlog_remaining: 0, error: "Job mestre não encontrado" };
  }
  if (master.status !== "running") {
    return {
      ok: true,
      has_more: false,
      backlog_remaining: 0,
      finished: true,
      error: `Job não está running (status=${master.status})`,
    };
  }

  const { data: claimed, error: claimErr } = await admin.rpc("sm_try_claim_promotion_step", {
    _job_id: masterJobId,
    _tenant_id: tenantId,
    _lease_seconds: 180,
  });
  if (claimErr) {
    return { ok: false, has_more: false, backlog_remaining: 0, error: `Falha ao reservar lote: ${claimErr.message}` };
  }
  if (!claimed) {
    const backlog = await countBacklog(admin, tenantId);
    return {
      ok: true,
      has_more: false,
      backlog_remaining: backlog,
      finished: false,
      error: "Outro lote já está em execução; aguardando finalizar.",
    };
  }

  try {

  // Marca início do step (safety cron usa isso para detectar travado)
  await admin
    .from("solarmarket_promotion_jobs")
    .update({ last_step_at: new Date().toISOString() })
    .eq("id", masterJobId);

  const backlogBefore = await countBacklog(admin, tenantId);
  if (backlogBefore <= 0) {
    await admin
      .from("solarmarket_promotion_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        items_processed: master.total_items ?? 0,
      })
      .eq("id", masterJobId);
    return { ok: true, has_more: false, backlog_remaining: 0, finished: true };
  }

  // Processa 1 chunk com fallback adaptativo para evitar 546/CPU limit
  const sub = await runAdaptivePromoteChunk(admin, tenantId);
  if (!sub.ok) {
    const backlogAfterTimeout = await countBacklog(admin, tenantId);
    const progressedDespiteTimeout = backlogAfterTimeout < backlogBefore;

    if (isGatewayTimeoutLike(sub.error) && progressedDespiteTimeout) {
      const processedDelta = backlogBefore - backlogAfterTimeout;
      const newProcessed = (master.items_processed ?? 0) + processedDelta;
      const newPromoted = (master.items_promoted ?? 0) + processedDelta;
      const finished = backlogAfterTimeout <= 0;

      await admin
        .from("solarmarket_promotion_jobs")
        .update({
          status: finished ? "completed" : "running",
          finished_at: finished ? new Date().toISOString() : null,
          items_processed: newProcessed,
          items_promoted: newPromoted,
          last_step_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_summary: null,
          metadata: {
            ...(master.metadata ?? {}),
            last_batch_used: sub.batch_used ?? null,
            adaptive_batch_recovered: true,
          },
        })
        .eq("id", masterJobId);

      return {
        ok: true,
        has_more: !finished,
        backlog_remaining: backlogAfterTimeout,
        finished,
        counters: {
          processed: newProcessed,
          promoted: newPromoted,
          errors: master.items_with_errors ?? 0,
          warnings: master.items_with_warnings ?? 0,
          blocked: master.items_blocked ?? 0,
          skipped: master.items_skipped ?? 0,
        },
        last_chunk: {
          processed: processedDelta,
          promoted: processedDelta,
          recovered_after_timeout: 1,
          batch_used: sub.batch_used ?? 0,
        },
      };
    }

    await admin
      .from("solarmarket_promotion_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_summary: `Chunk falhou: ${sub.error ?? "erro desconhecido"}`,
        metadata: {
          ...(master.metadata ?? {}),
          last_batch_used: sub.batch_used ?? null,
        },
      })
      .eq("id", masterJobId);
    return {
      ok: false,
      has_more: false,
      backlog_remaining: backlogBefore,
      error: `Chunk falhou: ${sub.error ?? "erro"}`,
    };
  }

  const c = sub.counters ?? {};
  const promoted = Number(c.promoted ?? 0);
  const errors = Number(c.errors ?? 0);
  const warnings = Number(c.warnings ?? 0);
  const blocked = Number(c.blocked ?? 0);
  const skipped = Number(c.skipped ?? 0);
  const processedDelta = Number(c.processed ?? 0);

  const subJobs = Array.isArray((master.metadata as { sub_jobs?: unknown[] })?.sub_jobs)
    ? ((master.metadata as { sub_jobs: unknown[] }).sub_jobs as unknown[])
    : [];
  const newSubJobs = [
    ...subJobs.slice(-50), // mantém últimos 50 para não inflar
    { id: sub.job_id, status: sub.status, counters: c, ts: new Date().toISOString() },
  ];

  const newProcessed = (master.items_processed ?? 0) + processedDelta;
  const newPromoted = (master.items_promoted ?? 0) + promoted;
  const newErrors = (master.items_with_errors ?? 0) + errors;
  const newWarnings = (master.items_with_warnings ?? 0) + warnings;
  const newBlocked = (master.items_blocked ?? 0) + blocked;
  const newSkipped = (master.items_skipped ?? 0) + skipped;

  await admin
    .from("solarmarket_promotion_jobs")
    .update({
      items_processed: newProcessed,
      items_promoted: newPromoted,
      items_with_errors: newErrors,
      items_with_warnings: newWarnings,
      items_blocked: newBlocked,
      items_skipped: newSkipped,
      metadata: { ...(master.metadata ?? {}), sub_jobs: newSubJobs },
      last_step_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", masterJobId);

  const backlogAfter = await countBacklog(admin, tenantId);
  const hasMore = backlogAfter > 0 && processedDelta > 0;

  if (backlogAfter > 0 && processedDelta === 0) {
    await admin
      .from("solarmarket_promotion_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_summary: "stuck: chunk não processou nenhum item; abortando para evitar loop infinito.",
      })
      .eq("id", masterJobId);
    return {
      ok: false,
      has_more: false,
      backlog_remaining: backlogAfter,
      counters: { processed: newProcessed, promoted: newPromoted, errors: newErrors },
      last_chunk: c,
      error: "Chunk não avançou — abortado.",
    };
  }

  if (!hasMore) {
    await admin
      .from("solarmarket_promotion_jobs")
      .update({
        status: newErrors > 0 ? "completed_with_warnings" : "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", masterJobId);
  }

  return {
    ok: true,
    has_more: hasMore,
    backlog_remaining: backlogAfter,
    finished: !hasMore,
    counters: {
      processed: newProcessed,
      promoted: newPromoted,
      errors: newErrors,
      warnings: newWarnings,
      blocked: newBlocked,
      skipped: newSkipped,
    },
    last_chunk: c,
  };
  } finally {
    await admin.rpc("sm_release_promotion_step", {
      _job_id: masterJobId,
      _tenant_id: tenantId,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(body.action ?? "step");
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    // ── action: cron_resume — chamado pelo pg_cron OU por auto-encadeamento.
    //    NÃO exige JWT de usuário — exige header secreto.
    if (action === "cron_resume") {
      const cronSecret = req.headers.get("x-sm-cron-secret");
      if (cronSecret !== CRON_SECRET) {
        return jsonResponse({ ok: false, error: "Forbidden" }, 403);
      }
      const masterJobId = String(payload.master_job_id ?? "");
      const tenantId = String(payload.tenant_id ?? "");
      if (!masterJobId || !tenantId) {
        return jsonResponse({ ok: false, error: "master_job_id e tenant_id obrigatórios" }, 400);
      }

      const { data: resumableJob } = await admin
        .from("solarmarket_promotion_jobs")
        .select("id, status, error_summary")
        .eq("id", masterJobId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (
        resumableJob &&
        ["failed", "cancelled"].includes(String(resumableJob.status ?? "")) &&
        isGatewayTimeoutLike(String(resumableJob.error_summary ?? ""))
      ) {
        const { data: resumedRows, error: resumeErr } = await admin
          .from("solarmarket_promotion_jobs")
          .update({
            status: "running",
            finished_at: null,
            error_summary: null,
            last_step_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", masterJobId)
          .eq("tenant_id", tenantId)
          .select("id");

        if (resumeErr || !resumedRows || resumedRows.length === 0) {
          return jsonResponse({ ok: false, error: "Falha ao reativar job interno" }, 409);
        }
      }

      const result = await processStep(admin, tenantId, masterJobId);

      // Auto-encadeamento: se ainda há trabalho, agenda próximo via waitUntil.
      // O response atual será enviado de imediato; o fetch dispara em background.
      if (result.ok && result.has_more) {
        // @ts-ignore — EdgeRuntime existe em Deno Deploy
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(scheduleNextStep(masterJobId, tenantId));
        } else {
          // fallback fire-and-forget
          void scheduleNextStep(masterJobId, tenantId);
        }
      }

      return jsonResponse(result);
    }

    // ── Daqui para baixo, ações de usuário (exigem JWT)
    const authHeader = req.headers.get("Authorization");
    const ctx = await resolveUserContext(authHeader);
    if (!ctx) return jsonResponse({ ok: false, error: "Não autenticado" }, 401);

    // ── action: status
    if (action === "status") {
      const masterJobId = String(payload.master_job_id ?? "");
      if (!masterJobId) return jsonResponse({ ok: false, error: "master_job_id obrigatório" }, 400);
      const { data, error } = await admin
        .from("solarmarket_promotion_jobs")
        .select(
          "id, status, total_items, items_processed, items_promoted, items_with_errors, items_with_warnings, items_blocked, items_skipped, started_at, finished_at, last_step_at, metadata",
        )
        .eq("id", masterJobId)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      return jsonResponse({ ok: true, job: data });
    }

    // ── action: cancel
    if (action === "cancel") {
      const masterJobId = String(payload.master_job_id ?? "");
      if (!masterJobId) return jsonResponse({ ok: false, error: "master_job_id obrigatório" }, 400);
      const { data, error } = await admin
        .from("solarmarket_promotion_jobs")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
          error_summary: "Cancelado pelo usuário",
        })
        .eq("id", masterJobId)
        .eq("tenant_id", ctx.tenantId)
        .in("status", ["pending", "running"])
        .select("id");
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      if (!data || data.length === 0) {
        return jsonResponse({ ok: false, error: "Job não cancelável" }, 409);
      }
      return jsonResponse({ ok: true, status: "cancelled" });
    }

    // ── action: continue — retoma um job existente (botão "Continuar")
    if (action === "continue") {
      const masterJobId = String(payload.master_job_id ?? "");
      if (!masterJobId) return jsonResponse({ ok: false, error: "master_job_id obrigatório" }, 400);

      // Reativa o job (se estava failed/cancelled) e dispara primeiro step
      const { data: updated, error: upErr } = await admin
        .from("solarmarket_promotion_jobs")
        .update({
          status: "running",
          finished_at: null,
          error_summary: null,
          last_step_at: new Date().toISOString(),
        })
        .eq("id", masterJobId)
        .eq("tenant_id", ctx.tenantId)
        .in("status", ["failed", "cancelled", "running"])
        .select("id");

      if (upErr || !updated || updated.length === 0) {
        return jsonResponse({ ok: false, error: "Job não retomável" }, 409);
      }

      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(scheduleNextStep(masterJobId, ctx.tenantId));
      } else {
        void scheduleNextStep(masterJobId, ctx.tenantId);
      }

      return jsonResponse({ ok: true, master_job_id: masterJobId, resumed: true });
    }

    // ── action: start — cria job mestre + dispara primeiro step em background
    if (action === "start") {
      // Bloqueia se já existe um running do mesmo tenant
      const { data: existing } = await admin
        .from("solarmarket_promotion_jobs")
        .select("id")
        .eq("tenant_id", ctx.tenantId)
        .eq("job_type", "migrate-chunked")
        .eq("status", "running")
        .limit(1);

      if (existing && existing.length > 0) {
        return jsonResponse({
          ok: false,
          error: "Já existe uma migração em andamento.",
          existing_job_id: existing[0].id,
        }, 409);
      }

      const backlog = await countBacklog(admin, ctx.tenantId);
      const { data: created, error: createErr } = await admin
        .from("solarmarket_promotion_jobs")
        .insert({
          tenant_id: ctx.tenantId,
          triggered_by: ctx.userId,
          trigger_source: "manual",
          job_type: "migrate-chunked",
          status: "running",
          filters: { chunk_size: CHUNK_BATCH, mode: "chunked" },
          metadata: { sub_jobs: [] },
          total_items: backlog,
          items_processed: 0,
          items_promoted: 0,
          items_with_errors: 0,
          items_with_warnings: 0,
          items_blocked: 0,
          items_skipped: 0,
          started_at: new Date().toISOString(),
          last_step_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (createErr || !created?.id) {
        return jsonResponse(
          { ok: false, error: `Falha criando job: ${createErr?.message ?? "sem id"}` },
          500,
        );
      }

      // Dispara primeiro step em background — UI não espera
      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(scheduleNextStep(created.id, ctx.tenantId));
      } else {
        void scheduleNextStep(created.id, ctx.tenantId);
      }

      return jsonResponse({
        ok: true,
        master_job_id: created.id,
        total_backlog: backlog,
        background: true,
      });
    }

    // ── action: step (legado — mantido para compatibilidade, mas processa síncrono)
    if (action === "step") {
      const masterJobId = String(payload.master_job_id ?? "");
      if (!masterJobId) return jsonResponse({ ok: false, error: "master_job_id obrigatório" }, 400);
      const result = await processStep(admin, ctx.tenantId, masterJobId);
      return jsonResponse(result);
    }

    return jsonResponse({ ok: false, error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${MODULE}] erro:`, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
