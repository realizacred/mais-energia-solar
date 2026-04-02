import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://api-d1542.cloud.solaryum.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENDPOINT_MAP: Record<string, string> = {
  "BuscarFiltros": "/integracaoPlataforma/BuscarFiltros",
  "BuscarKits": "/integracaoPlataforma/BuscarKits",
  "MontarKits": "/integracaoPlataforma/MontarKits",
  "Produtos": "/hubB2B/Produtos",
  "Categoria": "/hubB2B/Categoria",
  "FormasDePagamento": "/hubB2B/FormasDePagamento",
  "BuscarFretes": "/hubB2B/BuscarFretes",
};

const ALLOWED_ENDPOINTS = Object.keys(ENDPOINT_MAP);

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
    const params = { ...(body.params ?? {}) } as Record<string, unknown>;

    if (!distribuidor || !["vertys", "jng"].includes(distribuidor)) {
      return jsonResponse({ error: "Distribuidor inválido" }, 400);
    }

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
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

    // Build HubB2B URL
    const path = ENDPOINT_MAP[endpoint] ?? `/${endpoint}`;
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("token", token);

    // Convert potenciaDoKit (kWp) to Watts with ±20% range
    if (params.potenciaDoKit != null) {
      const potW = Number(params.potenciaDoKit) * 1000;
      url.searchParams.set("potenciaMinima", String(potW * 0.8));
      url.searchParams.set("potenciaMaxima", String(potW * 1.2));
      delete params.potenciaDoKit;
    }

    // Remove params not supported by HubB2B
    delete params.fase;
    delete params.tensao;
    delete params.tipoInv;
    delete params.marcaPainel;
    delete params.marcaInversor;
    delete params.cifComDescarga;

    // Pass remaining params (ibge, paginaAtual, etc.)
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
