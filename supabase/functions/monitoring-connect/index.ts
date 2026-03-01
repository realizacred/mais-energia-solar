import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Solarman Business API — obtain access token using platform credentials */
async function solarmanAuthenticate(login: string, password: string) {
  const appId = Deno.env.get("SOLARMAN_APP_ID");
  const appSecret = Deno.env.get("SOLARMAN_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("Platform credentials (SOLARMAN_APP_ID/SECRET) not configured");
  }

  // SHA-256 hex of password
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const url = `https://api.solarmanpv.com/account/v1.0/token?appId=${encodeURIComponent(appId)}&language=en`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appSecret,
      email: login,
      password: hashHex,
    }),
  });

  const json = await res.json();

  if (!json.access_token) {
    throw new Error(json.msg || json.message || "Solarman authentication failed — no access_token returned");
  }

  return {
    access_token: json.access_token as string,
    token_type: (json.token_type as string) || "bearer",
    expires_in: (json.expires_in as number) || 7200,
    uid: json.uid as number,
    orgId: json.orgId as number | undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    // Resolve tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return jsonResponse({ error: "Tenant not found" }, 403);
    }
    const tenantId = profile.tenant_id;

    // Parse body — GDASH pattern: only login + password from user
    const body = await req.json();
    const { provider, login, password } = body;

    if (provider !== "solarman_business") {
      return jsonResponse({ error: "Unsupported provider" }, 400);
    }

    if (!login || !password) {
      return jsonResponse({ error: "Missing credentials: login, password" }, 400);
    }

    // Authenticate with Solarman using platform AppId/AppSecret from env
    let tokenResult: Awaited<ReturnType<typeof solarmanAuthenticate>>;
    try {
      tokenResult = await solarmanAuthenticate(login, password);
    } catch (err) {
      // Save error status — NEVER store password
      await supabaseAdmin.from("monitoring_integrations").upsert(
        {
          tenant_id: tenantId,
          provider,
          status: "error",
          sync_error: (err as Error).message?.slice(0, 500) || "Authentication failed",
          credentials: { login },
          tokens: {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" },
      );

      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: userId,
        acao: "monitoring.integration.error",
        tabela: "monitoring_integrations",
        dados_novos: { provider, error: (err as Error).message },
      });

      return jsonResponse({ error: `Authentication failed: ${(err as Error).message}` }, 400);
    }

    // Upsert integration — connected
    const expiresAt = new Date(Date.now() + tokenResult.expires_in * 1000).toISOString();
    const { data: integration, error: upsertErr } = await supabaseAdmin
      .from("monitoring_integrations")
      .upsert(
        {
          tenant_id: tenantId,
          provider,
          status: "connected",
          sync_error: null,
          credentials: { login },
          tokens: {
            access_token: tokenResult.access_token,
            token_type: tokenResult.token_type,
            expires_at: expiresAt,
            uid: tokenResult.uid,
            orgId: tokenResult.orgId,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" },
      )
      .select("id, status")
      .single();

    if (upsertErr) throw upsertErr;

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      acao: "monitoring.integration.connected",
      tabela: "monitoring_integrations",
      registro_id: integration?.id,
      dados_novos: { provider, status: "connected" },
    });

    return jsonResponse({
      success: true,
      integration_id: integration?.id,
      status: "connected",
    });
  } catch (err) {
    console.error("monitoring-connect error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
