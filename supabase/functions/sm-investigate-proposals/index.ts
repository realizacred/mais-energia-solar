// sm-investigate-proposals — Investigação temporária (NÃO toca staging).
// Objetivo: descobrir como propostas SM se relacionam com funis/etapas.
// Faz signin, lista projetos, pega 1 proposta, testa endpoints de vínculo.
// Pode ser deletado após análise.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function normalizeBaseUrl(u: string) {
  return (u || "").replace(/\/+$/, "");
}

async function smSignIn(baseUrl: string, token: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`signin failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  const access = body?.access_token || body?.token || body?.data?.access_token;
  if (!access) throw new Error("no access_token in signin response");
  return access;
}

async function smGet(baseUrl: string, accessToken: string, path: string, query?: Record<string, string | number>) {
  const url = new URL(`${baseUrl}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Aceita tenant_id via body (service role) — investigação temporária
    let tenantId: string | null = null;
    try {
      const body = await req.json().catch(() => ({}));
      tenantId = body?.tenant_id ?? null;
    } catch { /* ignore */ }

    if (!tenantId) {
      // Fallback: tentar via JWT do usuário
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader) {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          const { data: profile } = await admin
            .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
          tenantId = (profile as any)?.tenant_id ?? null;
        }
      }
    }
    if (!tenantId) throw new Error("tenant_id obrigatório (via body ou JWT)");

    const { data: cfg } = await admin
      .from("integrations_api_configs")
      .select("base_url, credentials")
      .eq("tenant_id", tenantId)
      .eq("provider", "solarmarket")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseUrl = normalizeBaseUrl((cfg as any)?.base_url || "");
    const token = ((cfg as any)?.credentials?.api_token || "").trim();
    if (!baseUrl || !token) throw new Error("Config SM ausente.");

    const access = await smSignIn(baseUrl, token);

    // ─── ETAPA 1: Listar projetos (pegar IDs para depois)
    const projects = await smGet(baseUrl, access, "/projects", { page: 1, limit: 5 });

    // Extrair primeiro project id da resposta (defensivo a múltiplos formatos)
    const projList: any[] =
      Array.isArray(projects.body) ? projects.body :
      projects.body?.data ?? projects.body?.results ?? projects.body?.items ?? [];

    // ─── ETAPA 1.5: Listar mais projetos e iterar até encontrar 1 com propostas
    const projectsBig = await smGet(baseUrl, access, "/projects", { page: 1, limit: 50 });
    const projListBig: any[] =
      Array.isArray(projectsBig.body) ? projectsBig.body :
      projectsBig.body?.data ?? projectsBig.body?.results ?? projectsBig.body?.items ?? [];

    let firstProjId: number | string | null = projList[0]?.id ?? projList[0]?._id ?? null;
    let projProposals: any = null;
    let propList: any[] = [];
    let firstPropId: any = null;

    for (const p of projListBig) {
      const pid = p?.id ?? p?._id;
      if (!pid) continue;
      const r = await smGet(baseUrl, access, `/projects/${pid}/proposals`);
      const list: any[] =
        Array.isArray(r.body) ? r.body :
        r.body?.data ?? r.body?.results ?? r.body?.items ?? [];
      if (list.length > 0) {
        firstProjId = pid;
        projProposals = r;
        propList = list;
        firstPropId = list[0]?.id ?? list[0]?._id ?? null;
        break;
      }
    }

    // ─── ETAPA 3: Testar variantes de endpoint global de propostas
    const altListings: Record<string, any> = {};
    const altPaths = [
      "/proposals",
      "/proposal",
      "/quotes",
      "/quotations",
      "/propostas",
      "/projects/proposals",
      "/v2/proposals",
    ];
    for (const path of altPaths) {
      const r = await smGet(baseUrl, access, path, { limit: 5 });
      altListings[`GET ${path}?limit=5`] = {
        status: r.status,
        bodyPreview: typeof r.body === "string"
          ? r.body.slice(0, 200)
          : Array.isArray(r.body)
            ? { isArray: true, count: r.body.length, firstKeys: r.body[0] ? Object.keys(r.body[0]) : [] }
            : r.body && typeof r.body === "object"
              ? { keys: Object.keys(r.body).slice(0, 20), sample: r.status === 200 ? r.body : undefined }
              : r.body,
      };
      // Se achou uma proposta, captura
      if (r.status === 200 && !firstPropId) {
        const list: any[] = Array.isArray(r.body) ? r.body : r.body?.data ?? r.body?.results ?? r.body?.items ?? [];
        if (list.length > 0) {
          firstPropId = list[0]?.id ?? list[0]?._id ?? null;
          propList = list;
        }
      }
    }
    const globalProposals = altListings["GET /proposals?limit=5"];

    // ─── ETAPA 4: Testar endpoints de vínculo de funil em propostas
    const tests: Record<string, any> = {};
    if (firstPropId) {
      tests["GET /proposals/:id"] = await smGet(baseUrl, access, `/proposals/${firstPropId}`);
      tests["GET /proposals/:id/funnels"] = await smGet(baseUrl, access, `/proposals/${firstPropId}/funnels`);
      tests["GET /proposals/:id?include=funnels,stages"] = await smGet(
        baseUrl, access, `/proposals/${firstPropId}`, { include: "funnels,stages" }
      );
      tests["GET /proposals/:id/stages"] = await smGet(baseUrl, access, `/proposals/${firstPropId}/stages`);
      tests["GET /proposals/:id/pipeline"] = await smGet(baseUrl, access, `/proposals/${firstPropId}/pipeline`);
    }

    // ─── ETAPA 5: Testar endpoint de funis do projeto (já conhecido)
    let projFunnels: any = null;
    if (firstProjId) {
      projFunnels = await smGet(baseUrl, access, `/projects/${firstProjId}/funnels`);
    }

    // ─── Compactar saída: payload completo de UMA proposta + chaves
    const sampleProposal = propList[0] ?? null;
    const sampleKeys = sampleProposal ? Object.keys(sampleProposal) : [];

    // ─── ETAPA 6: Pegar projeto completo + variantes para ver se proposta é embutida
    const fullProject = firstProjId ? await smGet(baseUrl, access, `/projects/${firstProjId}`) : null;
    const projectIncludeProposals = firstProjId
      ? await smGet(baseUrl, access, `/projects/${firstProjId}`, { include: "proposals,kits,quotes" })
      : null;
    const projectKits = firstProjId ? await smGet(baseUrl, access, `/projects/${firstProjId}/kits`) : null;
    const projectQuotes = firstProjId ? await smGet(baseUrl, access, `/projects/${firstProjId}/quotes`) : null;
    const projectProposalsPlural = firstProjId ? await smGet(baseUrl, access, `/projects/${firstProjId}/proposal`) : null;

    const projectExtras = {
      "GET /projects/:id (full)": fullProject ? { status: fullProject.status, keys: fullProject.body && typeof fullProject.body === "object" ? Object.keys(fullProject.body) : [], body: fullProject.body } : null,
      "GET /projects/:id?include=proposals,kits,quotes": projectIncludeProposals ? { status: projectIncludeProposals.status, body: projectIncludeProposals.body } : null,
      "GET /projects/:id/kits": projectKits ? { status: projectKits.status, body: projectKits.body } : null,
      "GET /projects/:id/quotes": projectQuotes ? { status: projectQuotes.status, body: projectQuotes.body } : null,
      "GET /projects/:id/proposal (singular)": projectProposalsPlural ? { status: projectProposalsPlural.status, body: projectProposalsPlural.body } : null,
    };

    return new Response(
      JSON.stringify({
        ok: true,
        baseUrl,
        firstProjId,
        firstPropId,
        sampleProposalKeys: sampleKeys,
        sampleProposalFull: sampleProposal,
        listings: {
          "GET /projects?limit=5": { status: projects.status, count: projList.length },
          "GET /projects/:id/proposals": projProposals
            ? { status: projProposals.status, count: propList.length, sampleBodyKeys: projProposals.body && typeof projProposals.body === "object" ? Object.keys(projProposals.body).slice(0, 20) : null }
            : null,
          altEndpointVariants: altListings,
          projectExtras,
          "GET /projects/:id/funnels": projFunnels
            ? { status: projFunnels.status, body: projFunnels.body }
            : null,
        },
        proposalEndpointTests: Object.fromEntries(
          Object.entries(tests).map(([k, v]: any) => [
            k,
            {
              status: v.status,
              ok: v.ok,
              bodyPreview: typeof v.body === "string"
                ? v.body.slice(0, 400)
                : v.body && typeof v.body === "object"
                  ? (Array.isArray(v.body)
                    ? { isArray: true, count: v.body.length, firstKeys: v.body[0] ? Object.keys(v.body[0]) : [] }
                    : { keys: Object.keys(v.body).slice(0, 30), sample: v.body })
                  : v.body,
            },
          ]),
        ),
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
