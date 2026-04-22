// sm-import-project-funnels: enriquece o staging com vínculos
// projeto-funil-etapa via GET /projects/:id/funnels.
// Conformidade: RB-23 (sem console.log), RB-52 (JWT refresh por batch),
// RB-57 (resetGlobalState — sem `let` no escopo de módulo),
// RB-58 (verificar count em INSERTs).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SM_URL_FALLBACK = Deno.env.get("SM_URL") ?? "";
const SM_TOKEN_FALLBACK = Deno.env.get("SM_TOKEN") ?? "";

// RB-57: estado por request — nunca em escopo de módulo.
function createInitialState() {
  return {
    processed: 0,
    vinculosCreated: 0,
    errors: [] as Array<{ sm_project_id: number; error: string }>,
    lastProcessedId: 0,
  };
}

function normalizeBaseUrl(u: string): string {
  return (u || "").replace(/\/+$/, "");
}

async function loadTenantConfig(admin: any, tenantId: string) {
  const { data } = await admin
    .from("integrations_api_configs")
    .select("base_url, credentials")
    .eq("tenant_id", tenantId)
    .eq("provider", "solarmarket")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseUrl = normalizeBaseUrl((data as any)?.base_url || SM_URL_FALLBACK);
  const token = (((data as any)?.credentials?.api_token) ||
    SM_TOKEN_FALLBACK || "").trim();
  return { baseUrl, token };
}

async function smSignIn(baseUrl: string, apiToken: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: apiToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `signin failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  const access = body?.access_token || body?.token || body?.data?.access_token;
  if (!access) throw new Error("signin sem access_token");
  return access;
}

async function fetchProjectFunnels(
  baseUrl: string,
  accessToken: string,
  projectId: number,
): Promise<any[]> {
  const res = await fetch(`${baseUrl}/projects/${projectId}/funnels`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const body = await res.json().catch(() => null);
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.items)) return body.items;
  return [];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // RB-57: novo estado por request
  const state = createInitialState();

  try {
    const {
      tenantId,
      batchSize = 50,
      throttleMs = 1000,
      resumeFromId = null,
    } = await req.json();

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Credenciais + signin
    const cfg = await loadTenantConfig(admin, tenantId);
    if (!cfg.baseUrl || !cfg.token) {
      return new Response(
        JSON.stringify({
          error: "Config SolarMarket ausente para esse tenant",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const accessToken = await smSignIn(cfg.baseUrl, cfg.token);

    // Buscar projetos pendentes (que ainda não têm vínculo em sm_projeto_funis_raw)
    // Estratégia: pegar todos external_id de sm_projetos_raw acima de resumeFromId,
    // depois filtrar em memória os já processados.
    const resumeNum = resumeFromId ? Number(resumeFromId) : 0;

    const { data: projetosAll, error: pErr } = await admin
      .from("sm_projetos_raw")
      .select("external_id")
      .eq("tenant_id", tenantId)
      .order("external_id", { ascending: true });

    if (pErr) throw pErr;

    const allIds = (projetosAll ?? [])
      .map((r: any) => Number(r.external_id))
      .filter((n) => Number.isFinite(n) && n > resumeNum);

    // Quais já estão processados?
    const { data: jaImportados } = await admin
      .from("sm_projeto_funis_raw")
      .select("sm_project_id")
      .eq("tenant_id", tenantId);

    const processadosSet = new Set(
      (jaImportados ?? []).map((r: any) => Number(r.sm_project_id)),
    );

    const pendentes = allIds
      .filter((id) => !processadosSet.has(id))
      .slice(0, batchSize);

    const totalPendentesAntes = allIds.filter((id) => !processadosSet.has(id))
      .length;

    // Loop por projeto
    for (const sm_project_id of pendentes) {
      try {
        if (state.processed > 0) {
          await sleep(throttleMs);
        }

        const funnels = await fetchProjectFunnels(
          cfg.baseUrl,
          accessToken,
          sm_project_id,
        );

        if (Array.isArray(funnels) && funnels.length > 0) {
          const rows = funnels.map((f: any) => ({
            tenant_id: tenantId,
            sm_project_id,
            sm_funnel_id: Number(f?.id ?? f?.funnel_id ?? f?._id ?? 0),
            sm_stage_id: f?.stage?.id != null
              ? Number(f.stage.id)
              : (f?.stage_id != null ? Number(f.stage_id) : null),
            payload: f,
          })).filter((r) => r.sm_funnel_id > 0);

          if (rows.length > 0) {
            const { data: upserted, error: insErr } = await admin
              .from("sm_projeto_funis_raw")
              .upsert(rows, {
                onConflict: "tenant_id,sm_project_id,sm_funnel_id",
              })
              .select("id");

            if (insErr) throw insErr;
            // RB-58: confirmar quantas linhas foram afetadas
            state.vinculosCreated += (upserted?.length ?? 0);
          }
        }

        state.processed += 1;
        state.lastProcessedId = sm_project_id;
      } catch (e: any) {
        state.errors.push({
          sm_project_id,
          error: e?.message || String(e),
        });
        state.lastProcessedId = sm_project_id;
      }
    }

    const hasMore = totalPendentesAntes > pendentes.length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: state.processed,
        total_funnel_vinculos_created: state.vinculosCreated,
        errors: state.errors,
        last_processed_id: state.lastProcessedId,
        has_more: hasMore,
        pendentes_restantes: Math.max(
          totalPendentesAntes - pendentes.length,
          0,
        ),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[sm-import-project-funnels] error:", e?.message);
    return new Response(
      JSON.stringify({
        error: e?.message || String(e),
        partial_state: state,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
