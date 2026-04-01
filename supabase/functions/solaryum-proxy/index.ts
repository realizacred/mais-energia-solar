import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const VERTYS_BASE = "https://app.vertys.com.br/api";
const JNG_BASE = Deno.env.get("SOLARYUM_JNG_BASE_URL") || "https://api-d1542.cloud.solaryum.com.br";
const ALLOWED_ENDPOINTS = ["BuscarFiltros", "BuscarKits", "MontarKits"] as const;

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function parseUpstreamBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { raw: await response.text() };
    }
  }
  return { raw: await response.text() };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return jsonResponse({ error: "Tenant não encontrado" }, 400);
    }

    let body: { distribuidor?: "vertys" | "jng"; endpoint?: string; params?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body JSON inválido" }, 400);
    }

    const distribuidor = body.distribuidor;
    const endpoint = body.endpoint;
    const params = body.params ?? {};

    if (!distribuidor || !["vertys", "jng"].includes(distribuidor)) {
      return jsonResponse({ error: "Distribuidor inválido" }, 400);
    }

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint as (typeof ALLOWED_ENDPOINTS)[number])) {
      return jsonResponse({ error: `Endpoint não permitido: ${endpoint}` }, 400);
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return jsonResponse({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, 500);
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

    const { data: configs, error: configError } = await serviceClient
      .from("integrations_api_configs")
      .select("id, credentials, is_active, status, updated_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", distribuidor)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (configError) {
      return jsonResponse(
        { error: `Falha ao carregar configuração ${distribuidor}: ${configError.message}` },
        500
      );
    }

    const apiConfig = (configs || []).find((cfg: any) => cfg?.is_active) ?? (configs || [])[0] ?? null;
    const creds = (apiConfig?.credentials || {}) as Record<string, string>;
    const token = creds.token || creds.api_key || creds.access_token || null;

    if (!token) {
      return jsonResponse({ error: "Token Solaryum não configurado para este distribuidor" }, 400);
    }

    const baseUrl = distribuidor === "vertys" ? VERTYS_BASE : JNG_BASE;
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/integracaoPlataforma/${endpoint}`);
    url.searchParams.set("token", token);

    for (const [key, value] of Object.entries(params)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }

    let apiResponse: Response;
    try {
      apiResponse = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
    } catch (fetchError: any) {
      return jsonResponse(
        {
          error: "Falha de rede ao acessar Solaryum",
          details: fetchError?.message || "Erro desconhecido",
        },
        502
      );
    }

    const parsedBody = await parseUpstreamBody(apiResponse);

    if (!apiResponse.ok) {
      return jsonResponse(
        {
          error: `Solaryum API error: ${apiResponse.status}`,
          details: parsedBody,
        },
        apiResponse.status
      );
    }

    return jsonResponse(parsedBody, 200);
  } catch (e) {
    console.error("[solaryum-proxy] Error:", e);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});