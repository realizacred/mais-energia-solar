import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  console.log("[SM-Auth] Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth check: only admins ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Token de autenticação não encontrado. Faça login novamente." }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[SM-Auth] Auth error:", userError?.message);
      return jsonRes({ error: "Sessão expirada. Faça login novamente." }, 401);
    }

    console.log("[SM-Auth] User authenticated:", userData.user.id);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isAdmin = roles?.some((r: any) =>
      ["admin", "gerente", "financeiro"].includes(r.role)
    );

    if (!isAdmin) {
      return jsonRes({ error: "Apenas administradores podem testar a conexão" }, 403);
    }

    // ── Get API token: DB config first, then Supabase secret as fallback ──
    const { data: config } = await supabaseAdmin
      .from("solar_market_config")
      .select("id, api_token, base_url")
      .limit(1)
      .maybeSingle();

    let apiToken = config?.api_token || null;
    if (!apiToken) {
      apiToken = Deno.env.get("SOLARMARKET_TOKEN") || null;
    }

    if (!apiToken) {
      console.error("[SM-Auth] No API token configured");
      return jsonRes({
        error: "Token da API SolarMarket não configurado. Salve o token na aba Config ou configure o Secret SOLARMARKET_TOKEN."
      }, 400);
    }

    const baseUrl = config?.base_url || "https://business.solarmarket.com.br/api/v2";

    // ── Authenticate with SolarMarket API ──
    console.log("[SM-Auth] Authenticating with SolarMarket...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(`${baseUrl}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ token: apiToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[SM-Auth] SolarMarket auth failed (${res.status}): ${errorText}`);
      return jsonRes({
        error: `Falha na autenticação SolarMarket (${res.status})`,
        details: errorText,
      }, res.status >= 500 ? 502 : 400);
    }

    const data = await res.json();
    const accessToken = data.access_token || data.accessToken || data.token;

    if (!accessToken) {
      console.error("[SM-Auth] No access_token in response:", JSON.stringify(data));
      return jsonRes({ error: "SolarMarket não retornou access_token na resposta" }, 502);
    }

    // Cache the token in config for the sync function
    if (config?.id) {
      const expiresAt = new Date(Date.now() + (5 * 60 + 55) * 60_000).toISOString();
      await supabaseAdmin.from("solar_market_config").update({
        last_token: accessToken,
        last_token_expires_at: expiresAt,
      }).eq("id", config.id);
    }

    console.log("[SM-Auth] Authentication successful");

    return jsonRes({
      status: "ok",
      message: "Conexão com SolarMarket bem-sucedida",
      access_token: accessToken,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return jsonRes({ error: "Timeout ao conectar com SolarMarket (15s)" }, 504);
    }
    console.error("[SM-Auth] Unexpected error:", err.message);
    return jsonRes({ error: `Erro inesperado: ${err.message}` }, 500);
  }
});
