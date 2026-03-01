import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Solarman Business API — obtain access token */
async function solarmanAuthenticate(creds: {
  appId: string;
  appSecret: string;
  email: string;
  password: string;
}): Promise<{ access_token: string; token_type: string; expires_in: number; uid: number; orgId?: number }> {
  // Solarman expects password as SHA-256 hex
  const encoder = new TextEncoder();
  const data = encoder.encode(creds.password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const url = `https://api.solarmanpv.com/account/v1.0/token?appId=${encodeURIComponent(creds.appId)}&language=en`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appSecret: creds.appSecret,
      email: creds.email,
      password: hashHex,
    }),
  });

  const json = await res.json();
  if (!json.success && !json.access_token) {
    throw new Error(json.msg || json.message || "Solarman authentication failed");
  }

  return {
    access_token: json.access_token,
    token_type: json.token_type || "bearer",
    expires_in: json.expires_in || 7200,
    uid: json.uid,
    orgId: json.orgId,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabaseUser.auth.getUser();
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.user.id;

    // Resolve tenant
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;
    const body = await req.json();
    const { provider, credentials } = body;

    if (provider !== "solarman_business") {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { appId, appSecret, email, password } = credentials || {};
    if (!appId || !appSecret || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Missing credentials: appId, appSecret, email, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate with Solarman
    let tokenResult;
    try {
      tokenResult = await solarmanAuthenticate({ appId, appSecret, email, password });
    } catch (err) {
      // Save error status
      await supabaseAdmin.from("monitoring_integrations").upsert(
        {
          tenant_id: tenantId,
          provider,
          status: "error",
          sync_error: err.message,
          credentials: { appId, email }, // never store password
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" }
      );

      // Audit
      await supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId,
        user_id: userId,
        acao: "monitoring.integration.error",
        tabela: "monitoring_integrations",
        dados_novos: { provider, error: err.message },
      });

      return new Response(
        JSON.stringify({ error: `Authentication failed: ${err.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert integration
    const expiresAt = new Date(Date.now() + tokenResult.expires_in * 1000).toISOString();
    const { data: integration, error: upsertErr } = await supabaseAdmin
      .from("monitoring_integrations")
      .upsert(
        {
          tenant_id: tenantId,
          provider,
          status: "connected",
          sync_error: null,
          credentials: { appId, email }, // never store raw password
          tokens: {
            access_token: tokenResult.access_token,
            token_type: tokenResult.token_type,
            expires_at: expiresAt,
            uid: tokenResult.uid,
            orgId: tokenResult.orgId,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,provider" }
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

    return new Response(
      JSON.stringify({
        success: true,
        integration_id: integration?.id,
        status: "connected",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("monitoring-connect error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
