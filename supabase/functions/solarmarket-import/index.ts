// solarmarket-import — Importação one-shot do SolarMarket
// Doc oficial: https://solarmarket.readme.io/
// Auth: POST {base_url}/auth/signin com { token } -> retorna access_token JWT (6h)
// Rate limits oficiais: 60 req/min, 1.800 req/h
//
// IMPORTANTE (RB-57): Sem `let` em escopo de módulo. Estado por request.
// IMPORTANTE: Configuração lida de `integrations_api_configs` (provider='solarmarket').
// Fallback aos secrets SOLARMARKET_API_URL / SOLARMARKET_API_TOKEN para retrocompat.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SM_URL_FALLBACK = Deno.env.get("SOLARMARKET_API_URL");
const SM_TOKEN_FALLBACK = Deno.env.get("SOLARMARKET_API_TOKEN");
const EXTERNAL_SOURCE = "solarmarket";

// Throttle: ~55 req/min = 1100ms entre chamadas (margem de segurança contra 60/min)
const MIN_INTERVAL_MS = 1100;
const MAX_RETRIES_429 = 4;

function normalizeBaseUrl(u: string | undefined | null): string {
  if (!u) return "";
  let s = u.trim().replace(/\/+$/, "");
  // Tolerar URL colada com sufixos comuns: /auth/signin, /users/me, etc.
  s = s.replace(/\/(auth\/signin|auth\/login|users\/me)\/?$/i, "");
  return s.replace(/\/+$/, "");
}

interface RequestState {
  smBaseUrl: string;
  smApiToken: string; // token estático da API (não logar)
  smAccessToken: string | null; // JWT temporário em memória (escopo do request)
  smAccessTokenExpiresAt: number; // epoch ms
  lastCallAt: number;
  jobId: string | null;
  configId: string | null;
  tenantId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
}

function createInitialState(
  tenantId: string,
  userId: string,
  baseUrl: string,
  token: string,
  configId: string | null,
): RequestState {
  return {
    smBaseUrl: normalizeBaseUrl(baseUrl),
    smApiToken: token,
    smAccessToken: null,
    smAccessTokenExpiresAt: 0,
    lastCallAt: 0,
    jobId: null,
    configId,
    tenantId,
    userId,
    supabase: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  };
}

/** Carrega config ativa do tenant; fallback aos secrets se não houver. */
async function loadTenantConfig(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<{ baseUrl: string; token: string; configId: string | null }> {
  const { data } = await admin
    .from("integrations_api_configs")
    .select("id, base_url, credentials, is_active")
    .eq("tenant_id", tenantId)
    .eq("provider", "solarmarket")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dbBase = (data as any)?.base_url as string | null | undefined;
  const dbToken = ((data as any)?.credentials as any)?.api_token as
    | string
    | undefined;

  const baseUrl = normalizeBaseUrl(dbBase || SM_URL_FALLBACK || "");
  const token = (dbToken || SM_TOKEN_FALLBACK || "").trim();
  const configId = (data as any)?.id ?? null;

  return { baseUrl, token, configId };
}

/** Throttle entre chamadas para respeitar 60 req/min. */
async function throttle(state: RequestState) {
  const now = Date.now();
  const wait = state.lastCallAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  state.lastCallAt = Date.now();
}

async function smSignIn(state: RequestState): Promise<void> {
  if (!state.smBaseUrl || !state.smApiToken) {
    throw new Error(
      "Integração SolarMarket não configurada para este tenant. Acesse /admin/configuracoes/integracoes/solarmarket.",
    );
  }
  await throttle(state);
  const res = await fetch(`${state.smBaseUrl}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: state.smApiToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Falha no signin SolarMarket (${res.status}): ${
        (body as any)?.message || JSON.stringify(body).slice(0, 200)
      }`,
    );
  }
  const access =
    (body as any)?.access_token ||
    (body as any)?.token ||
    (body as any)?.data?.access_token;
  if (!access) {
    throw new Error(
      "Resposta de signin sem access_token reconhecível. Verifique a URL base.",
    );
  }
  state.smAccessToken = access;
  // 6h de validade — usar 5h50min para margem
  state.smAccessTokenExpiresAt = Date.now() + 350 * 60 * 1000;
}

async function ensureAccessToken(state: RequestState) {
  if (
    !state.smAccessToken ||
    Date.now() >= state.smAccessTokenExpiresAt - 60_000
  ) {
    await smSignIn(state);
  }
}

async function smGet(
  state: RequestState,
  path: string,
  query?: Record<string, string | number>,
): Promise<{ ok: boolean; status: number; body: any }> {
  await ensureAccessToken(state);
  const url = new URL(`${state.smBaseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }

  let attempt = 0;
  while (true) {
    await throttle(state);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${state.smAccessToken}`,
        Accept: "application/json",
      },
    });

    // 401 → reauth e tenta uma vez
    if (res.status === 401 && attempt === 0) {
      attempt++;
      await smSignIn(state);
      continue;
    }

    // 429 → backoff exponencial
    if (res.status === 429 && attempt < MAX_RETRIES_429) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30_000, 2 ** attempt * 1000);
      console.error(
        `[solarmarket-import] 429 rate limit em ${path}, aguardando ${wait}ms (tentativa ${attempt + 1})`,
      );
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
      continue;
    }

    // 5xx → backoff exponencial
    if (res.status >= 500 && attempt < MAX_RETRIES_429) {
      const wait = Math.min(15_000, 2 ** attempt * 500);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
      continue;
    }

    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  }
}

async function logEntry(
  state: RequestState,
  entity: string,
  action: "created" | "updated" | "skipped" | "error",
  externalId: string | null,
  internalId: string | null,
  error?: string,
  payloadSnippet?: any,
) {
  if (!state.jobId) return;
  await state.supabase.from("solarmarket_import_logs").insert({
    job_id: state.jobId,
    tenant_id: state.tenantId,
    entity_type: entity,
    external_id: externalId,
    internal_id: internalId,
    action,
    error_message: error ?? null,
    payload_snippet: payloadSnippet ?? null,
  });
}

async function updateJob(
  state: RequestState,
  patch: Record<string, unknown>,
) {
  if (!state.jobId) return;
  await state.supabase
    .from("solarmarket_import_jobs")
    .update(patch)
    .eq("id", state.jobId);
}

async function markConfigTest(
  state: RequestState,
  success: boolean,
  message?: string,
) {
  if (!state.configId) return;
  await state.supabase
    .from("integrations_api_configs")
    .update({
      last_tested_at: new Date().toISOString(),
      status: success ? "connected" : "error",
      ...(message ? { settings: { last_test_message: message } } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.configId);
}

// -------- Importadores (best-effort, paths comuns) --------

function pickArray(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

async function tryPaths(
  state: RequestState,
  candidates: string[],
  entityKey?: string,
): Promise<{ path: string; body: any } | null> {
  const attempts: string[] = [];
  for (const p of candidates) {
    const r = await smGet(state, p, { limit: 1 });
    attempts.push(`${p}→${r.status}`);
    if (r.ok) {
      if (entityKey) {
        await logEntry(state, entityKey, "skipped", null, null,
          `[probe] Endpoints testados: ${attempts.join(", ")}. Selecionado: ${p}`);
      }
      return { path: p, body: r.body };
    }
  }
  if (entityKey) {
    await logEntry(state, entityKey, "error", null, null,
      `[probe] Nenhum endpoint respondeu OK. Tentativas: ${attempts.join(", ")}`);
  }
  return null;
}

/** Verifica se o job foi cancelado externamente (UI). */
async function isJobCancelled(state: RequestState): Promise<boolean> {
  if (!state.jobId) return false;
  const { data } = await state.supabase
    .from("solarmarket_import_jobs")
    .select("status")
    .eq("id", state.jobId)
    .maybeSingle();
  return (data as any)?.status === "cancelled";
}

async function importEntity(
  state: RequestState,
  entityKey: string,
  candidatePaths: string[],
  mapper: (item: any) => Promise<"created" | "updated" | "skipped" | "error">,
  opts: {
    counterField?: string; // ex: "total_clientes" — atualiza incrementalmente
    progressStart?: number; // % no início
    progressEnd?: number; // % ao final
  } = {},
): Promise<{ count: number; errors: number; pathUsed: string | null }> {
  const startedAt = new Date().toISOString();
  await logEntry(
    state,
    entityKey,
    "skipped",
    null,
    null,
    `[start] Buscando endpoint para ${entityKey}. Candidatos: ${candidatePaths.join(", ")}`,
  );

  const found = await tryPaths(state, candidatePaths, entityKey);
  if (!found) {
    await logEntry(
      state,
      entityKey,
      "error",
      null,
      null,
      `Nenhum endpoint funcionou. Tentados: ${candidatePaths.join(", ")}.`,
    );
    return { count: 0, errors: 1, pathUsed: null };
  }

  await logEntry(
    state,
    entityKey,
    "skipped",
    null,
    null,
    `[endpoint] ${entityKey} usando "${found.path}" (started_at=${startedAt})`,
  );

  let count = 0;
  let errors = 0;
  let page = 1;
  const limit = 100;
  const pStart = opts.progressStart ?? 0;
  const pEnd = opts.progressEnd ?? 0;

  while (true) {
    if (await isJobCancelled(state)) {
      await logEntry(
        state,
        entityKey,
        "skipped",
        null,
        null,
        `[cancelled] Importação interrompida em ${entityKey} (page=${page}, count=${count})`,
      );
      return { count, errors, pathUsed: found.path };
    }

    const r = await smGet(state, found.path, { page, limit });
    if (!r.ok) {
      errors++;
      await logEntry(state, entityKey, "error", null, null, `HTTP ${r.status}`);
      break;
    }
    const items = pickArray(r.body);
    if (items.length === 0) break;
    for (const item of items) {
      try {
        await mapper(item);
        count++;
      } catch (e) {
        errors++;
        await logEntry(
          state,
          entityKey,
          "error",
          String(item?.id ?? ""),
          null,
          (e as Error).message,
        );
      }
    }

    // Atualiza job incrementalmente (contador parcial + progress + updated_at vivo)
    if (opts.counterField) {
      const incrementalProgress = pEnd > pStart
        ? Math.min(pEnd, pStart + Math.round((pEnd - pStart) * (page / Math.max(page, 5))))
        : undefined;
      await updateJob(state, {
        [opts.counterField]: count,
        ...(incrementalProgress !== undefined ? { progress_pct: incrementalProgress } : {}),
        updated_at: new Date().toISOString(),
      });
    }

    if (items.length < limit) break;
    page++;
    if (page > 200) break; // hard stop
  }

  await logEntry(
    state,
    entityKey,
    "skipped",
    null,
    null,
    `[end] ${entityKey} concluído: count=${count}, errors=${errors}, endpoint="${found.path}"`,
  );

  return { count, errors, pathUsed: found.path };
}

// ─────────────────────────────────────────────────────────────────────
// Mappers (P0 — contenção arquitetural):
//   Gravação EXCLUSIVA em camada raw/staging (sm_*_raw).
//   NÃO toca em clientes / projetos / propostas_nativas.
//   Idempotência via UNIQUE (tenant_id, external_id).
// ─────────────────────────────────────────────────────────────────────

async function upsertRaw(
  state: RequestState,
  table: "sm_clientes_raw" | "sm_projetos_raw" | "sm_propostas_raw" | "sm_funis_raw" | "sm_custom_fields_raw",
  externalId: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await state.supabase
    .from(table)
    .upsert(
      {
        tenant_id: state.tenantId,
        external_id: externalId,
        payload,
        imported_at: new Date().toISOString(),
        import_job_id: state.jobId,
      },
      { onConflict: "tenant_id,external_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data?.id as string | undefined;
}

async function mapCliente(state: RequestState, item: any) {
  const externalId = String(item?.id ?? item?.uuid ?? "");
  if (!externalId) return "skipped" as const;
  const rawId = await upsertRaw(state, "sm_clientes_raw", externalId, item ?? {});
  await logEntry(state, "cliente", "updated", externalId, rawId ?? null);
  return "updated" as const;
}

async function mapProjeto(state: RequestState, item: any) {
  const externalId = String(item?.id ?? "");
  if (!externalId) return "skipped" as const;
  const rawId = await upsertRaw(state, "sm_projetos_raw", externalId, item ?? {});
  await logEntry(state, "projeto", "updated", externalId, rawId ?? null);
  return "updated" as const;
}

async function mapProposta(state: RequestState, item: any) {
  const externalId = String(item?.id ?? "");
  if (!externalId) return "skipped" as const;
  const rawId = await upsertRaw(state, "sm_propostas_raw", externalId, item ?? {});
  await logEntry(state, "proposta", "updated", externalId, rawId ?? null);
  return "updated" as const;
}

async function runImportJob(
  state: RequestState,
  adminClient: ReturnType<typeof createClient>,
  sc: Record<string, boolean>,
) {
  await updateJob(state, {
    status: "running",
    current_step: "auth",
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_message: null,
  });

  await smSignIn(state);
  await markConfigTest(state, true);

  let totalErrors = 0;

  const checkCancel = async (): Promise<boolean> => {
    if (await isJobCancelled(state)) {
      await logEntry(state, "job", "skipped", null, null, "[cancelled] Importação interrompida pelo usuário.");
      return true;
    }
    return false;
  };

  let totalFunis = 0;
  let totalEtapas = 0;
  if (sc.funis) {
    if (await checkCancel()) return { ok: false, job_id: state.jobId, status: "cancelled", cancelled: true };
    await updateJob(state, { current_step: "funis", progress_pct: 5, updated_at: new Date().toISOString() });

    const funisFound = await tryPaths(state, ["/pipelines", "/funnels", "/funis"], "funil");
    if (!funisFound) {
      await logEntry(state, "funil", "error", null, null,
        "Nenhum endpoint de funis respondeu (testados: /pipelines, /funnels, /funis). Verifique a documentação da sua conta SolarMarket e atualize a função.");
      totalErrors++;
    } else {
      const funis = pickArray(funisFound.body);
      await logEntry(state, "funil", "skipped", null, null,
        `[endpoint] Funis usando "${funisFound.path}" — ${funis.length} item(s) na primeira página`);

      let page = 1;
      while (true) {
        const r = await smGet(state, funisFound.path, { page, limit: 100 });
        if (!r.ok) break;
        const items = pickArray(r.body);
        if (items.length === 0) break;
        for (const f of items) {
          totalFunis++;
          const stages = f?.stages || f?.etapas || f?.steps || [];
          if (Array.isArray(stages)) totalEtapas += stages.length;
          const fExtId = String(f?.id ?? "");
          if (fExtId) {
            try { await upsertRaw(state, "sm_funis_raw", fExtId, f ?? {}); }
            catch (e) { await logEntry(state, "funil", "error", fExtId, null, (e as Error).message); }
          }
          await logEntry(state, "funil", "skipped",
            fExtId, null,
            `Funil "${f?.name ?? f?.nome ?? "?"}" — ${Array.isArray(stages) ? stages.length : 0} etapa(s)`);
        }
        if (items.length < 100) break;
        page++;
        if (page > 20) break;
      }
      await logEntry(state, "funil", "skipped", null, null,
        `[end] Funis: ${totalFunis} funil(is), ${totalEtapas} etapa(s) lidas do SolarMarket`);
    }
    await updateJob(state, {
      total_funis: totalFunis,
      progress_pct: 12,
      updated_at: new Date().toISOString(),
    });
  }

  if (sc.clientes) {
    if (await checkCancel()) return { ok: false, job_id: state.jobId, status: "cancelled", cancelled: true };
    await updateJob(state, { current_step: "clientes", progress_pct: 15, updated_at: new Date().toISOString() });
    const r = await importEntity(
      state,
      "cliente",
      ["/clients", "/customers", "/clientes"],
      (item) => mapCliente(state, item),
      { counterField: "total_clientes", progressStart: 15, progressEnd: 40 },
    );
    await updateJob(state, { total_clientes: r.count, progress_pct: 40, updated_at: new Date().toISOString() });
    totalErrors += r.errors;
  }

  if (sc.projetos) {
    if (await checkCancel()) return { ok: false, job_id: state.jobId, status: "cancelled", cancelled: true };
    await updateJob(state, { current_step: "projetos", progress_pct: 45, updated_at: new Date().toISOString() });
    const r = await importEntity(
      state,
      "projeto",
      ["/projects", "/deals", "/projetos"],
      (item) => mapProjeto(state, item),
      { counterField: "total_projetos", progressStart: 45, progressEnd: 70 },
    );
    await updateJob(state, { total_projetos: r.count, progress_pct: 70, updated_at: new Date().toISOString() });
    totalErrors += r.errors;
  }

  if (sc.propostas) {
    if (await checkCancel()) return { ok: false, job_id: state.jobId, status: "cancelled", cancelled: true };
    await updateJob(state, { current_step: "propostas", progress_pct: 75, updated_at: new Date().toISOString() });
    const r = await importEntity(
      state,
      "proposta",
      ["/proposals", "/quotes", "/propostas"],
      (item) => mapProposta(state, item),
      { counterField: "total_propostas", progressStart: 75, progressEnd: 92 },
    );
    await updateJob(state, { total_propostas: r.count, progress_pct: 92, updated_at: new Date().toISOString() });
    totalErrors += r.errors;
  }

  let totalCampos = 0;
  if (sc.custom_fields) {
    if (await checkCancel()) return { ok: false, job_id: state.jobId, status: "cancelled", cancelled: true };
    await updateJob(state, { current_step: "custom_fields", progress_pct: 95, updated_at: new Date().toISOString() });

    const cfFound = await tryPaths(state, ["/custom-fields", "/customFields", "/campos-customizados"], "custom_field");
    if (!cfFound) {
      await logEntry(state, "custom_field", "error", null, null,
        "Nenhum endpoint de campos customizados respondeu (testados: /custom-fields, /customFields, /campos-customizados).");
      totalErrors++;
    } else {
      const items = pickArray(cfFound.body);
      totalCampos = items.length;
      await logEntry(state, "custom_field", "skipped", null, null,
        `[endpoint] Campos customizados usando "${cfFound.path}" — ${totalCampos} item(s) lidos`);
      for (const cf of items) {
        const cfExtId = String(cf?.id ?? "");
        if (cfExtId) {
          try { await upsertRaw(state, "sm_custom_fields_raw", cfExtId, cf ?? {}); }
          catch (e) { await logEntry(state, "custom_field", "error", cfExtId, null, (e as Error).message); }
        }
      }
      for (const cf of items.slice(0, 20)) {
        await logEntry(state, "custom_field", "skipped",
          String(cf?.id ?? ""), null,
          `Campo "${cf?.name ?? cf?.label ?? "?"}" tipo=${cf?.type ?? "?"}`);
      }
    }
    await updateJob(state, {
      total_custom_fields: totalCampos,
      updated_at: new Date().toISOString(),
    });
  }

  const totalImportado =
    (totalFunis || 0) + (totalCampos || 0) +
    (await (async () => {
      const { data } = await adminClient
        .from("solarmarket_import_jobs")
        .select("total_clientes,total_projetos,total_propostas")
        .eq("id", state.jobId!)
        .single();
      return ((data as any)?.total_clientes ?? 0) +
             ((data as any)?.total_projetos ?? 0) +
             ((data as any)?.total_propostas ?? 0);
    })());

  const wasCancelled = await isJobCancelled(state);

  const finalStatus = wasCancelled
    ? "cancelled"
    : totalErrors > 0
      ? "partial"
      : totalImportado === 0
        ? "partial"
        : "success";

  if (!wasCancelled && totalImportado === 0 && totalErrors === 0) {
    await logEntry(state, "job", "skipped", null, null,
      "[warning] Nenhum dado foi importado. Verifique se a integração está apontando para o ambiente correto e se há dados na conta SolarMarket.");
  }

  const { data: updRows } = await adminClient
    .from("solarmarket_import_jobs")
    .update({
      status: finalStatus,
      current_step: wasCancelled ? "cancelled" : "done",
      ...(wasCancelled ? {} : { progress_pct: 100 }),
      total_errors: totalErrors,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(wasCancelled
        ? { error_message: "Cancelado manualmente pelo usuário durante a importação." }
        : {}),
    })
    .eq("id", state.jobId!)
    .in("status", ["running", "pending"])
    .select("id");

  if (!updRows || updRows.length === 0) {
    await logEntry(state, "job", "skipped", null, null,
      `[finalize] Job já estava em estado terminal — status preservado. importado=${totalImportado}, errors=${totalErrors}`);
  }

  if (state.configId) {
    await adminClient
      .from("integrations_api_configs")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", state.configId);
  }

  return {
    ok: true,
    job_id: state.jobId,
    status: finalStatus,
    summary: { funis: totalFunis, etapas: totalEtapas, custom_fields: totalCampos, errors: totalErrors },
  };
}

// -------- Handler principal --------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let adminClient: ReturnType<typeof createClient> | null = null;
  let state: RequestState | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, scope } = body;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const isInternalJobDispatch = action === "process-job" && token === SUPABASE_SERVICE_ROLE_KEY;

    let userId = "";
    let tenantId = "";

    if (isInternalJobDispatch) {
      userId = String(body.triggered_by ?? "");
      tenantId = String(body.tenant_id ?? "");
      if (!userId || !tenantId) {
        return new Response(JSON.stringify({ error: "tenant_id e triggered_by são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: cErr } = await supabaseAuth.auth.getUser(token);
      if (cErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = userData.user.id;
    }

    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    if (!isInternalJobDispatch) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile?.tenant_id) {
        return new Response(
          JSON.stringify({ error: "Usuário sem tenant vinculado" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      tenantId = profile.tenant_id as string;
    }

    // Carrega config tenant-safe
    const cfg = await loadTenantConfig(adminClient, tenantId);

    if (!cfg.baseUrl || !cfg.token) {
      return new Response(
        JSON.stringify({
          error:
            "Integração SolarMarket não configurada. Acesse Admin → Configurações → Integrações → SolarMarket para cadastrar URL base e token.",
          code: "not_configured",
        }),
        {
          status: 412,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    state = createInitialState(
      tenantId,
      userId,
      cfg.baseUrl,
      cfg.token,
      cfg.configId,
    );

    // ---- test-connection ----
    if (action === "test-connection") {
      try {
        await smSignIn(state);
        await markConfigTest(state, true);
        return new Response(
          JSON.stringify({
            ok: true,
            message: "Conexão estabelecida com sucesso.",
            base_url: state.smBaseUrl,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (e) {
        await markConfigTest(state, false, (e as Error).message);
        throw e;
      }
    }

    // ---- import-all (com escopo) ----
    if (action === "import-all") {
      const sc = scope || {
        clientes: true,
        projetos: true,
        propostas: true,
        funis: true,
        custom_fields: true,
      };

      const { data: job, error: jobErr } = await adminClient
        .from("solarmarket_import_jobs")
        .insert({
          tenant_id: state.tenantId,
          triggered_by: userId,
          scope: sc,
          status: "pending",
          started_at: new Date().toISOString(),
          current_step: "auth",
        })
        .select("id")
        .single();
      if (jobErr) throw new Error(jobErr.message);
      state.jobId = String((job as any)?.id ?? "");
      if (!state.jobId) throw new Error("Falha ao criar job de importação.");

      fetch(`${SUPABASE_URL}/functions/v1/solarmarket-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: "process-job",
          job_id: state.jobId,
          scope: sc,
          tenant_id: state.tenantId,
          triggered_by: userId,
        }),
      }).catch((e) => console.error("[solarmarket-import] fire-and-forget error:", e?.message ?? String(e)));

      return new Response(
        JSON.stringify({
          ok: true,
          job_id: state.jobId,
          status: "pending",
          queued: true,
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "process-job") {
      const bodyJobId = typeof body.job_id === "string" ? body.job_id : undefined;
      const jobId = bodyJobId;
      const scoped = body.scope ?? scope;

      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      state.jobId = jobId;
      const result = await runImportJob(state, adminClient, scoped || {});
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- clear-history ----
    // Apaga apenas histórico finalizado: solarmarket_import_jobs (success/partial/error/cancelled)
    // e seus solarmarket_import_logs relacionados. Jobs running/pending são preservados.
    // NÃO toca em sm_*_raw nem em tabelas nativas (clientes/projetos/propostas_nativas).
    if (action === "clear-history") {
      const { data: finishedJobs, error: jobsErr } = await state.supabase
        .from("solarmarket_import_jobs")
        .select("id")
        .eq("tenant_id", state.tenantId)
        .in("status", ["success", "partial", "error", "cancelled"]);

      if (jobsErr) {
        return new Response(
          JSON.stringify({ error: `Falha ao listar jobs: ${jobsErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const jobIds = (finishedJobs ?? []).map((j: any) => j.id);
      let removedLogs = 0;
      let removedJobs = 0;

      if (jobIds.length > 0) {
        const { count: lc, error: lErr } = await state.supabase
          .from("solarmarket_import_logs")
          .delete({ count: "exact" })
          .eq("tenant_id", state.tenantId)
          .in("job_id", jobIds);
        if (lErr) {
          return new Response(
            JSON.stringify({ error: `Falha ao apagar logs: ${lErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        removedLogs = lc ?? 0;

        const { count: jc, error: jErr } = await state.supabase
          .from("solarmarket_import_jobs")
          .delete({ count: "exact" })
          .eq("tenant_id", state.tenantId)
          .in("id", jobIds);
        if (jErr) {
          return new Response(
            JSON.stringify({ error: `Falha ao apagar jobs: ${jErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        removedJobs = jc ?? 0;
      }

      return new Response(
        JSON.stringify({ ok: true, removed: { jobs: removedJobs, logs: removedLogs } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- clear-staging ----
    // Apaga apenas dados brutos do staging (sm_*_raw) do tenant atual.
    // Bloqueado se houver job pending/running. NÃO toca em domínio nativo.
    if (action === "clear-staging") {
      const { data: activeJob, error: actErr } = await state.supabase
        .from("solarmarket_import_jobs")
        .select("id")
        .eq("tenant_id", state.tenantId)
        .in("status", ["pending", "running"])
        .limit(1)
        .maybeSingle();
      if (actErr) {
        return new Response(
          JSON.stringify({ error: `Falha ao verificar jobs ativos: ${actErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (activeJob) {
        return new Response(
          JSON.stringify({
            error: "Existe uma importação em execução. Cancele-a antes de limpar o staging.",
            code: "active_job",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const tables = [
        "sm_propostas_raw",
        "sm_projetos_raw",
        "sm_clientes_raw",
        "sm_funis_raw",
        "sm_custom_fields_raw",
      ] as const;

      const removed: Record<string, number> = {};
      for (const tbl of tables) {
        const { count, error } = await state.supabase
          .from(tbl)
          .delete({ count: "exact" })
          .eq("tenant_id", state.tenantId);
        if (error) {
          return new Response(
            JSON.stringify({ error: `Falha ao apagar ${tbl}: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        removed[tbl] = count ?? 0;
      }

      return new Response(
        JSON.stringify({ ok: true, removed }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const message = (e as Error).message || "Erro interno na importação SolarMarket";

    if (state?.jobId) {
      await Promise.allSettled([
        logEntry(state, "job", "error", null, null, message),
        state.supabase
          .from("solarmarket_import_jobs")
          .update({
            status: "error",
            error_message: message,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", state.jobId)
          .in("status", ["pending", "running"])
          .select("id"),
      ]);
    }

    console.error("[solarmarket-import] erro:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
