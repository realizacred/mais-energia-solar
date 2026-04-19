// solarmarket-import — Importação one-shot do SolarMarket
// Doc oficial: https://solarmarket.readme.io/
// Auth: POST {SOLARMARKET_API_URL}/auth/signin com { token } -> retorna access_token JWT
//
// IMPORTANTE (RB-57): Sem `let` em escopo de módulo. Estado por request.
// IMPORTANTE: Endpoints exatos de listagem (clientes/projetos/propostas/funis/custom-fields)
// não estão explicitamente publicados na doc auditada. Esta função tenta paths comuns
// e registra explicitamente quais não foram encontrados — sem inventar estrutura.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SM_URL_RAW = Deno.env.get("SOLARMARKET_API_URL");
const SM_TOKEN = Deno.env.get("SOLARMARKET_API_TOKEN");
const EXTERNAL_SOURCE = "solarmarket";

function normalizeBaseUrl(u: string | undefined | null): string {
  if (!u) return "";
  return u.replace(/\/+$/, "");
}

interface RequestState {
  smBaseUrl: string;
  smAccessToken: string | null;
  jobId: string | null;
  tenantId: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
}

function createInitialState(
  tenantId: string,
  userId: string
): RequestState {
  return {
    smBaseUrl: normalizeBaseUrl(SM_URL_RAW),
    smAccessToken: null,
    jobId: null,
    tenantId,
    userId,
    supabase: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
  };
}

async function smSignIn(state: RequestState): Promise<void> {
  if (!state.smBaseUrl || !SM_TOKEN) {
    throw new Error(
      "Configuração ausente: defina SOLARMARKET_API_URL e SOLARMARKET_API_TOKEN nos secrets."
    );
  }
  const res = await fetch(`${state.smBaseUrl}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: SM_TOKEN }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Falha no signin SolarMarket (${res.status}): ${
        (body as any)?.message || JSON.stringify(body).slice(0, 200)
      }`
    );
  }
  const access =
    (body as any)?.access_token ||
    (body as any)?.token ||
    (body as any)?.data?.access_token;
  if (!access) {
    throw new Error(
      "Resposta de signin sem access_token reconhecível. Verifique SOLARMARKET_API_URL."
    );
  }
  state.smAccessToken = access;
}

async function smGet(
  state: RequestState,
  path: string,
  query?: Record<string, string | number>
): Promise<{ ok: boolean; status: number; body: any }> {
  if (!state.smAccessToken) await smSignIn(state);
  const url = new URL(`${state.smBaseUrl}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${state.smAccessToken}`,
      Accept: "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function logEntry(
  state: RequestState,
  entity: string,
  action: "created" | "updated" | "skipped" | "error",
  externalId: string | null,
  internalId: string | null,
  error?: string,
  payloadSnippet?: any
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
  patch: Record<string, unknown>
) {
  if (!state.jobId) return;
  await state.supabase
    .from("solarmarket_import_jobs")
    .update(patch)
    .eq("id", state.jobId);
}

// -------- Importadores (best-effort, paths comuns; declara não-documentados) --------

function pickArray(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

async function tryPaths(
  state: RequestState,
  candidates: string[]
): Promise<{ path: string; body: any } | null> {
  for (const p of candidates) {
    const r = await smGet(state, p, { limit: 1 });
    if (r.ok) return { path: p, body: r.body };
  }
  return null;
}

async function importEntity(
  state: RequestState,
  entityKey: string,
  candidatePaths: string[],
  mapper: (item: any) => Promise<"created" | "updated" | "skipped" | "error">
): Promise<{ count: number; errors: number; pathUsed: string | null }> {
  const found = await tryPaths(state, candidatePaths);
  if (!found) {
    await logEntry(
      state,
      entityKey,
      "error",
      null,
      null,
      `Nenhum endpoint funcionou. Tentados: ${candidatePaths.join(", ")}. Verifique a doc oficial.`
    );
    return { count: 0, errors: 1, pathUsed: null };
  }

  let count = 0;
  let errors = 0;
  let page = 1;
  const limit = 100;

  while (true) {
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
          (e as Error).message
        );
      }
    }
    if (items.length < limit) break;
    page++;
    if (page > 200) break; // hard stop
  }

  return { count, errors, pathUsed: found.path };
}

// Mappers — convertem item externo em upsert idempotente via (tenant_id, external_source, external_id)

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

  // Resolver cliente importado pelo external_id do cliente do SM
  const smClienteId =
    item?.client_id || item?.customer_id || item?.cliente_id || null;
  let clienteId: string | null = null;
  if (smClienteId) {
    const { data: cli } = await state.supabase
      .from("clientes")
      .select("id")
      .eq("tenant_id", state.tenantId)
      .eq("external_source", EXTERNAL_SOURCE)
      .eq("external_id", String(smClienteId))
      .maybeSingle();
    clienteId = cli?.id ?? null;
  }

  const payload: Record<string, unknown> = {
    tenant_id: state.tenantId,
    external_source: EXTERNAL_SOURCE,
    external_id: externalId,
    nome: item?.name || item?.nome || `Projeto SM-${externalId}`,
    cliente_id: clienteId,
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

  const smProjetoId =
    item?.project_id || item?.projeto_id || item?.deal_id || null;
  let projetoId: string | null = null;
  if (smProjetoId) {
    const { data: p } = await state.supabase
      .from("projetos")
      .select("id")
      .eq("tenant_id", state.tenantId)
      .eq("external_source", EXTERNAL_SOURCE)
      .eq("external_id", String(smProjetoId))
      .maybeSingle();
    projetoId = p?.id ?? null;
  }

  const payload: Record<string, unknown> = {
    tenant_id: state.tenantId,
    external_source: EXTERNAL_SOURCE,
    external_id: externalId,
    projeto_id: projetoId,
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
    const { data: claims, error: cErr } = await supabaseAuth.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

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
        }
      );
    }

    const state = createInitialState(profile.tenant_id, userId);

    const { action, scope } = await req.json().catch(() => ({}));

    if (!SM_URL_RAW || !SM_TOKEN) {
      return new Response(
        JSON.stringify({
          error:
            "Secrets ausentes: configure SOLARMARKET_API_URL e SOLARMARKET_API_TOKEN.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- test-connection ----
    if (action === "test-connection") {
      await smSignIn(state);
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Conexão estabelecida com sucesso.",
          base_url: state.smBaseUrl,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

      // Cria job
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

      let totalErrors = 0;

      if (sc.clientes) {
        await updateJob(state, { current_step: "clientes", progress_pct: 10 });
        const r = await importEntity(
          state,
          "cliente",
          ["/clients", "/customers", "/clientes"],
          (item) => mapCliente(state, item)
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
          (item) => mapProjeto(state, item)
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
          (item) => mapProposta(state, item)
        );
        await updateJob(state, { total_propostas: r.count, progress_pct: 85 });
        totalErrors += r.errors;
      }

      if (sc.funis) {
        await updateJob(state, { current_step: "funis", progress_pct: 90 });
        // Funis: endpoint não confirmado na doc pública. Registrar como não documentado.
        await logEntry(
          state,
          "funil",
          "skipped",
          null,
          null,
          "Endpoint de funis/etapas não confirmado na doc pública (https://solarmarket.readme.io/). Importação ignorada para evitar hallucination."
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
          "Endpoint de campos customizados não confirmado na doc pública. Importação ignorada."
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

      return new Response(
        JSON.stringify({ ok: true, job_id: state.jobId, status: finalStatus }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[solarmarket-import] erro:", (e as Error).message);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
