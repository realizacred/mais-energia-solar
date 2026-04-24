import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function buildJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveUserContext(admin: ReturnType<typeof createAdminClient>, authHeader: string) {
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!token || token === anonKey) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Token inválido ou expirado.");
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "gerente"])
    .limit(1)
    .maybeSingle();

  if (!roleRow) {
    throw new Error("Apenas admin/gerente pode executar esta ação.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) {
    throw new Error("Tenant não encontrado para o usuário autenticado.");
  }

  return { tenantId: profile.tenant_id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return buildJsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return buildJsonResponse({ error: "Authentication required" }, 401);
    }

    const admin = createAdminClient();
    const { tenantId } = await resolveUserContext(admin, authHeader);

    // Load Meta config from DB
    const { data: configs } = await admin
      .from("integration_configs")
      .select("service_key, api_key")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .in("service_key", [
        "meta_facebook_app_id",
        "meta_facebook_app_secret",
        "meta_facebook_verify_token",
      ]);

    let appId: string | null = null;
    let appSecret: string | null = null;
    let verifyToken: string | null = null;

    for (const row of configs ?? []) {
      if (row.service_key === "meta_facebook_app_id") appId = row.api_key;
      if (row.service_key === "meta_facebook_app_secret") appSecret = row.api_key;
      if (row.service_key === "meta_facebook_verify_token") verifyToken = row.api_key;
    }

    if (!appId || !appSecret) {
      return buildJsonResponse({
        success: false,
        error: "Configuração incompleta: app_id e app_secret são obrigatórios.",
      }, 400);
    }

    if (!verifyToken) {
      return buildJsonResponse({
        success: false,
        error: "Token de verificação do webhook não configurado.",
      }, 400);
    }

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-lead-webhook`;
    const appAccessToken = `${appId}|${appSecret}`;

    // Subscribe to leadgen field via Meta Graph API
    console.log(`[meta-webhook-setup] Subscribing leadgen for app=${appId}, callback=${callbackUrl}`);

    const subscribeUrl = `https://graph.facebook.com/v22.0/${appId}/subscriptions`;
    const body = new URLSearchParams({
      object: "page",
      callback_url: callbackUrl,
      fields: "leadgen",
      verify_token: verifyToken,
      access_token: appAccessToken,
    });

    const response = await fetch(subscribeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(20000),
    });

    const result = await response.json();

    if (!response.ok) {
      const errorMsg = result?.error?.message || result?.error?.error_user_msg || "Erro desconhecido";
      const errorCode = result?.error?.code;
      console.error(`[meta-webhook-setup] Failed: code=${errorCode} msg=${errorMsg}`);
      return buildJsonResponse({
        success: false,
        error: `Falha ao inscrever webhook: ${errorMsg}`,
        error_code: errorCode,
        details: result?.error,
      }, 422);
    }

    console.log(`[meta-webhook-setup] Success: ${JSON.stringify(result)}`);

    return buildJsonResponse({
      success: true,
      message: "Campo 'leadgen' inscrito com sucesso no webhook do Meta.",
      callback_url: callbackUrl,
      app_id: appId,
    });
  } catch (err: any) {
    console.error(`[meta-webhook-setup] Error: ${err.message}`);
    return buildJsonResponse({
      success: false,
      error: err.message || "Erro interno ao configurar webhook.",
    }, err.code === 403 ? 403 : 500);
  }
});
