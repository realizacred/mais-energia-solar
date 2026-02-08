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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Auth check: only admins can call this ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonRes({ error: "Unauthorized" }, 401);
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
    return jsonRes({ error: "Unauthorized" }, 401);
  }

  // Verify admin role
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

  // ── Read the secret token ──
  const solarMarketToken = Deno.env.get("SOLARMARKET_TOKEN");
  if (!solarMarketToken) {
    console.error("[SM-Auth] SOLARMARKET_TOKEN secret not configured");
    return jsonRes(
      { error: "Missing SOLARMARKET_TOKEN secret. Configure-o em Supabase Dashboard → Settings → Edge Functions → Secrets." },
      400
    );
  }

  // ── Authenticate with SolarMarket API ──
  const BASE_URL = "https://business.solarmarket.com.br/api/v2";

  try {
    console.log("[SM-Auth] Authenticating with SolarMarket...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000); // 15s timeout

    const res = await fetch(`${BASE_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: solarMarketToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[SM-Auth] SolarMarket auth failed (${res.status}): ${errorText}`);
      return jsonRes(
        {
          error: `Falha na autenticação SolarMarket (${res.status})`,
          details: errorText,
        },
        res.status >= 500 ? 502 : 400
      );
    }

    const data = await res.json();
    const accessToken =
      data.access_token || data.accessToken || data.token;

    if (!accessToken) {
      console.error("[SM-Auth] No access_token in response:", JSON.stringify(data));
      return jsonRes(
        { error: "SolarMarket não retornou access_token na resposta" },
        502
      );
    }

    console.log("[SM-Auth] Authentication successful");

    return jsonRes({
      status: "ok",
      message: "Conexão com SolarMarket bem-sucedida",
      access_token: accessToken,
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[SM-Auth] Request timed out");
      return jsonRes({ error: "Timeout ao conectar com SolarMarket (15s)" }, 504);
    }

    console.error("[SM-Auth] Unexpected error:", err.message);
    return jsonRes({ error: `Erro inesperado: ${err.message}` }, 500);
  }
});
