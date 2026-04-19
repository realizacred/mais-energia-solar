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
): Promise<{ path: string; body: any } | null> {
  for (const p of candidates) {
    const r = await smGet(state, p, { limit: 1 });
    if (r.ok) return { path: p, body: r.body };
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

  const found = await tryPaths(state, candidatePaths);
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

// Mappers — upsert idempotente via (tenant_id, external_source, external_id)

async function mapCliente(state: RequestState, item: any) {
  const externalId = String(item?.id ?? item?.uuid ?? "");
  if (!externalId) return "skipped" as const;

  const payload = {
    tenant_id: state.tenantId,
    external_source: EXTERNAL_SOURCE,
    external_id: externalId,
    nome: item?.name || item?.nome || item?.full_name || "Sem nome",
    email: item?.email ?? null,
    telefone: item?.phone || item?.telefone || item?.cellphone || "",
    cpf_cnpj: item?.document || item?.cpf_cnpj || item?.cpf || item?.cnpj || null,
    cidade: item?.city || item?.cidade || null,
    estado: item?.state || item?.estado || null,
    cliente_code: `SM-${externalId}`,
    ativo: true,
  };

  const { data: existing } = await state.supabase
    .from("clientes")
    .select("id")
    .eq("tenant_id", state.tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await state.supabase
      .from("clientes")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logEntry(state, "cliente", "updated", externalId, existing.id);
    return "updated" as const;
  }

  const { data: ins, error } = await state.supabase
    .from("clientes")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logEntry(state, "cliente", "created", externalId, ins.id);
  return "created" as const;
}

async function mapProjeto(state: RequestState, item: any) {
  const externalId = String(item?.id ?? "");
  if (!externalId) return "skipped" as const;

  // Cliente é PRÉ-REQUISITO: se não conseguir resolver, skip com motivo
  const smClienteId =
    item?.client_id || item?.customer_id || item?.cliente_id || null;
  if (!smClienteId) {
    await logEntry(
      state,
      "projeto",
      "skipped",
      externalId,
      null,
      "Projeto sem client_id; importação ignorada (integridade).",
    );
    return "skipped" as const;
  }
  const { data: cli } = await state.supabase
    .from("clientes")
    .select("id")
    .eq("tenant_id", state.tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", String(smClienteId))
    .maybeSingle();
  if (!cli?.id) {
    await logEntry(
      state,
      "projeto",
      "skipped",
      externalId,
      null,
      `Cliente externo ${smClienteId} não importado ainda; rode 'Clientes' antes.`,
    );
    return "skipped" as const;
  }

  const payload: Record<string, unknown> = {
    tenant_id: state.tenantId,
    external_source: EXTERNAL_SOURCE,
    external_id: externalId,
    nome: item?.name || item?.nome || `Projeto SM-${externalId}`,
    cliente_id: cli.id,
  };

  const { data: existing } = await state.supabase
    .from("projetos")
    .select("id")
    .eq("tenant_id", state.tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await state.supabase
      .from("projetos")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logEntry(state, "projeto", "updated", externalId, existing.id);
    return "updated" as const;
  }

  const { data: ins, error } = await state.supabase
    .from("projetos")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logEntry(state, "projeto", "created", externalId, ins.id);
  return "created" as const;
}

async function mapProposta(state: RequestState, item: any) {
  const externalId = String(item?.id ?? "");
  if (!externalId) return "skipped" as const;

  // Projeto é PRÉ-REQUISITO
  const smProjetoId =
    item?.project_id || item?.projeto_id || item?.deal_id || null;
  if (!smProjetoId) {
    await logEntry(
      state,
      "proposta",
      "skipped",
      externalId,
      null,
      "Proposta sem project_id; importação ignorada (integridade).",
    );
    return "skipped" as const;
  }
  const { data: p } = await state.supabase
    .from("projetos")
    .select("id")
    .eq("tenant_id", state.tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", String(smProjetoId))
    .maybeSingle();
  if (!p?.id) {
    await logEntry(
      state,
      "proposta",
      "skipped",
      externalId,
      null,
      `Projeto externo ${smProjetoId} não importado ainda; rode 'Projetos' antes.`,
    );
    return "skipped" as const;
  }

  const payload: Record<string, unknown> = {
    tenant_id: state.tenantId,
    external_source: EXTERNAL_SOURCE,
    external_id: externalId,
    projeto_id: p.id,
    valor_total: Number(item?.total_value || item?.value || item?.valor || 0),
    status: "rascunho",
  };

  const { data: existing } = await state.supabase
    .from("propostas_nativas")
    .select("id")
    .eq("tenant_id", state.tenantId)
    .eq("external_source", EXTERNAL_SOURCE)
    .eq("external_id", externalId)
    .maybeSingle();

  if (existing?.id) {
    await logEntry(state, "proposta", "skipped", externalId, existing.id);
    return "skipped" as const;
  }

  const { data: ins, error } = await state.supabase
    .from("propostas_nativas")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logEntry(state, "proposta", "created", externalId, ins.id);
  return "created" as const;
}

// -------- Handler principal --------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: descobrir user e tenant
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: cErr } = await supabaseAuth.auth.getUser(token);
    if (cErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    // Carrega config tenant-safe
    const tenantId = profile.tenant_id as string;
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

    const state = createInitialState(
      tenantId,
      userId,
      cfg.baseUrl,
      cfg.token,
      cfg.configId,
    );

    const { action, scope } = await req.json().catch(() => ({}));

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
          status: "running",
          started_at: new Date().toISOString(),
          current_step: "auth",
        })
        .select("id")
        .single();
      if (jobErr) throw new Error(jobErr.message);
      state.jobId = job.id;

      await smSignIn(state);
      await markConfigTest(state, true);

      let totalErrors = 0;

      if (sc.clientes) {
        await updateJob(state, { current_step: "clientes", progress_pct: 10 });
        const r = await importEntity(
          state,
          "cliente",
          ["/clients", "/customers", "/clientes"],
          (item) => mapCliente(state, item),
        );
        await updateJob(state, { total_clientes: r.count, progress_pct: 30 });
        totalErrors += r.errors;
      }

      if (sc.projetos) {
        await updateJob(state, { current_step: "projetos", progress_pct: 40 });
        const r = await importEntity(
          state,
          "projeto",
          ["/projects", "/deals", "/projetos"],
          (item) => mapProjeto(state, item),
        );
        await updateJob(state, { total_projetos: r.count, progress_pct: 60 });
        totalErrors += r.errors;
      }

      if (sc.propostas) {
        await updateJob(state, { current_step: "propostas", progress_pct: 70 });
        const r = await importEntity(
          state,
          "proposta",
          ["/proposals", "/quotes", "/propostas"],
          (item) => mapProposta(state, item),
        );
        await updateJob(state, { total_propostas: r.count, progress_pct: 85 });
        totalErrors += r.errors;
      }

      if (sc.funis) {
        await updateJob(state, { current_step: "funis", progress_pct: 90 });
        await logEntry(
          state,
          "funil",
          "skipped",
          null,
          null,
          "Endpoint de funis/etapas não confirmado na doc pública. Importação ignorada para evitar hallucination.",
        );
      }

      if (sc.custom_fields) {
        await updateJob(state, {
          current_step: "custom_fields",
          progress_pct: 95,
        });
        await logEntry(
          state,
          "custom_field",
          "skipped",
          null,
          null,
          "Endpoint de campos customizados não confirmado na doc pública. Importação ignorada.",
        );
      }

      const finalStatus = totalErrors > 0 ? "partial" : "success";
      await updateJob(state, {
        status: finalStatus,
        current_step: "done",
        progress_pct: 100,
        total_errors: totalErrors,
        finished_at: new Date().toISOString(),
      });

      // Atualiza last_sync_at na config
      if (state.configId) {
        await adminClient
          .from("integrations_api_configs")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("id", state.configId);
      }

      return new Response(
        JSON.stringify({ ok: true, job_id: state.jobId, status: finalStatus }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
    console.error("[solarmarket-import] erro:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
