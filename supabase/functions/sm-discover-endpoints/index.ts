// sm-discover-endpoints: TESTE de endpoints SolarMarket para descobrir
// qual retorna projetos com vínculo a funil/etapa.
// NÃO grava nada no banco — apenas testa e retorna relatório.
// Conformidade: RB-23 (sem console.log ativo), RB-26 (service role).

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

  const baseUrl = normalizeBaseUrl(
    (data as any)?.base_url || SM_URL_FALLBACK,
  );
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

interface ProbeResult {
  endpoint: string;
  status: number;
  ok: boolean;
  has_data: boolean;
  has_funnel_info: boolean;
  sample_keys: string[];
  funnel_evidence: string[];
  body_preview: string;
  error?: string;
}

async function probe(
  baseUrl: string,
  accessToken: string,
  label: string,
  path: string,
): Promise<ProbeResult> {
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      // not JSON
    }

    // Normalize: extract first record for inspection
    const list = Array.isArray(body)
      ? body
      : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.results)
      ? body.results
      : null;
    const first = list && list.length > 0 ? list[0] : (body && typeof body === "object" ? body : null);
    const sampleKeys = first && typeof first === "object" ? Object.keys(first).slice(0, 15) : [];

    // Heurística: chaves indicando funil/etapa
    const funnelKeys = [
      "funnel", "funnels", "funnel_id", "funnelId",
      "stage", "stages", "stage_id", "stageId",
      "pipeline", "pipeline_id", "pipelineId",
      "funil", "funis", "etapa", "etapas",
    ];
    const evidence: string[] = [];
    const haystack = first && typeof first === "object" ? first : {};
    for (const k of funnelKeys) {
      if (k in haystack) evidence.push(k);
    }

    return {
      endpoint: `${label}: GET ${path}`,
      status: res.status,
      ok: res.ok,
      has_data: !!list && list.length > 0,
      has_funnel_info: evidence.length > 0,
      sample_keys: sampleKeys,
      funnel_evidence: evidence,
      body_preview: text.slice(0, 400),
    };
  } catch (e: any) {
    return {
      endpoint: `${label}: GET ${path}`,
      status: 0,
      ok: false,
      has_data: false,
      has_funnel_info: false,
      sample_keys: [],
      funnel_evidence: [],
      body_preview: "",
      error: e?.message || String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenantId } = await req.json();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenantId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Pegar 1 funil do staging
    const { data: funilRow, error: funilErr } = await admin
      .from("sm_funis_raw")
      .select("payload")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (funilErr) throw funilErr;
    if (!funilRow) {
      return new Response(
        JSON.stringify({ error: "Nenhum funil em sm_funis_raw para esse tenant" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const funilPayload: any = (funilRow as any).payload ?? {};
    const funilId = funilPayload?.id ?? funilPayload?._id ?? funilPayload?.funnel_id;
    const stages = funilPayload?.stages ?? funilPayload?.steps ?? funilPayload?.etapas ?? [];
    const etapaId = Array.isArray(stages) && stages.length > 0
      ? (stages[0]?.id ?? stages[0]?._id)
      : null;

    // 2) Pegar 1 projeto do staging
    const { data: projRow } = await admin
      .from("sm_projetos_raw")
      .select("payload")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    const projetoPayload: any = (projRow as any)?.payload ?? {};
    const projetoId = projetoPayload?.id ?? projetoPayload?._id;

    // 3) Carregar credenciais e autenticar
    const cfg = await loadTenantConfig(admin, tenantId);
    if (!cfg.baseUrl || !cfg.token) {
      return new Response(
        JSON.stringify({ error: "Config SolarMarket ausente para esse tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const accessToken = await smSignIn(cfg.baseUrl, cfg.token);

    // 4) Probar endpoints
    const probes: ProbeResult[] = [];
    if (funilId) {
      probes.push(await probe(cfg.baseUrl, accessToken, "a", `/funnels/${funilId}/projects`));
      if (etapaId) {
        probes.push(await probe(cfg.baseUrl, accessToken, "b", `/funnels/${funilId}/stages/${etapaId}/projects`));
        probes.push(await probe(cfg.baseUrl, accessToken, "d", `/projects?funnel=${funilId}&stage=${etapaId}`));
      }
      probes.push(await probe(cfg.baseUrl, accessToken, "c", `/projects?funnelId=${funilId}`));
    }
    if (projetoId) {
      probes.push(await probe(cfg.baseUrl, accessToken, "e", `/projects/${projetoId}?include=funnels,stages`));
      probes.push(await probe(cfg.baseUrl, accessToken, "f", `/projects/${projetoId}/funnels`));
    }

    // 5) Recomendar
    const winner = probes.find((p) => p.ok && p.has_data && p.has_funnel_info)
      || probes.find((p) => p.ok && p.has_data)
      || null;

    const report = {
      tenantId,
      sample: { funilId, etapaId, projetoId },
      baseUrl: cfg.baseUrl,
      probes,
      recommended: winner ? winner.endpoint : "NENHUM endpoint retornou vínculo funil/etapa",
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[sm-discover-endpoints] error:", e?.message);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
