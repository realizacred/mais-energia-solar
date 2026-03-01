import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

// ─── Solarman helpers ──────────────────────────────────────
async function solarmanAuthenticate(creds: {
  appId: string;
  appSecret: string;
  email: string;
  password: string;
}) {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(creds.password));
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

// ─── SolisCloud signing helpers ────────────────────────────
async function solisContentMd5(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(body));
  return base64Encode(new Uint8Array(hash));
}

async function solisSign(
  apiSecret: string,
  contentMd5: string,
  contentType: string,
  dateStr: string,
  path: string,
): Promise<string> {
  const stringToSign = `POST\n${contentMd5}\n${contentType}\n${dateStr}\n${path}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(stringToSign));
  return base64Encode(new Uint8Array(sig));
}

async function solisTestConnection(apiId: string, apiSecret: string): Promise<void> {
  const path = "/v1/api/userStationList";
  const bodyStr = JSON.stringify({ pageNo: 1, pageSize: 1 });
  const contentMd5 = await solisContentMd5(bodyStr);
  const contentType = "application/json;charset=UTF-8";
  const dateStr = new Date().toUTCString();
  const sign = await solisSign(apiSecret, contentMd5, contentType, dateStr, path);

  const res = await fetch(`https://www.soliscloud.com:13333${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-MD5": contentMd5,
      "Date": dateStr,
      "Authorization": `API ${apiId}:${sign}`,
    },
    body: bodyStr,
  });
  const json = await res.json();
  if (!json.success && json.code !== "0") {
    throw new Error(json.msg || `SolisCloud validation failed (code=${json.code})`);
  }
}

// ─── Helpers for upsert + audit ────────────────────────────

interface ConnectContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string;
  userId: string;
  provider: string;
}

async function upsertIntegration(
  ctx: ConnectContext,
  data: {
    status: string;
    sync_error: string | null;
    credentials: Record<string, unknown>;
    tokens: Record<string, unknown>;
  },
) {
  const { data: integration, error } = await ctx.supabaseAdmin
    .from("monitoring_integrations")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        provider: ctx.provider,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,provider" },
    )
    .select("id, status")
    .single();
  if (error) throw error;
  return integration;
}

async function auditLog(
  ctx: ConnectContext,
  action: string,
  registroId: string | undefined,
  dados: Record<string, unknown>,
) {
  await ctx.supabaseAdmin.from("audit_logs").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    acao: action,
    tabela: "monitoring_integrations",
    registro_id: registroId,
    dados_novos: dados,
  });
}

// ─── Main handler ──────────────────────────────────────────

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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return jsonResponse({ error: "Tenant not found" }, 403);
    }
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { provider, credentials } = body;
    if (!provider || !credentials) {
      return jsonResponse({ error: "Missing provider or credentials" }, 400);
    }

    const ctx: ConnectContext = { supabaseAdmin, tenantId, userId, provider };

    // ── Solarman Business API ──
    if (provider === "solarman_business_api") {
      const { appId, appSecret, email, password } = credentials;
      if (!appId || !appSecret || !email || !password) {
        return jsonResponse({ error: "Missing credentials: appId, appSecret, email, password" }, 400);
      }

      try {
        const tokenResult = await solarmanAuthenticate({ appId, appSecret, email, password });
        const expiresAt = new Date(Date.now() + tokenResult.expires_in * 1000).toISOString();
        const integration = await upsertIntegration(ctx, {
          status: "connected",
          sync_error: null,
          credentials: { appId, email },
          tokens: {
            access_token: tokenResult.access_token,
            token_type: tokenResult.token_type,
            expires_at: expiresAt,
            uid: tokenResult.uid,
            orgId: tokenResult.orgId,
          },
        });
        await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: "connected" });
        return jsonResponse({ success: true, integration_id: integration?.id, status: "connected" });
      } catch (err) {
        const integration = await upsertIntegration(ctx, {
          status: "error",
          sync_error: (err as Error).message?.slice(0, 500) || "Authentication failed",
          credentials: { appId, email },
          tokens: {},
        });
        await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: (err as Error).message });
        return jsonResponse({ error: `Authentication failed: ${(err as Error).message}` }, 400);
      }
    }

    // ── Solis Cloud (API ID + Secret with HMAC-SHA1 test) ──
    if (provider === "solis_cloud") {
      const { apiId, apiSecret } = credentials;
      if (!apiId || !apiSecret) {
        return jsonResponse({ error: "Missing credentials: apiId, apiSecret" }, 400);
      }

      try {
        await solisTestConnection(apiId, apiSecret);
        const integration = await upsertIntegration(ctx, {
          status: "connected",
          sync_error: null,
          credentials: { apiId },
          tokens: { apiSecret },
        });
        await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: "connected" });
        return jsonResponse({ success: true, integration_id: integration?.id, status: "connected" });
      } catch (err) {
        const integration = await upsertIntegration(ctx, {
          status: "error",
          sync_error: (err as Error).message?.slice(0, 500) || "Validation failed",
          credentials: { apiId },
          tokens: {},
        });
        await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: (err as Error).message });
        return jsonResponse({ error: `SolisCloud validation failed: ${(err as Error).message}` }, 400);
      }
    }

    // ── SolarEdge (API Key — test by listing sites) ──
    if (provider === "solaredge") {
      const { apiKey } = credentials;
      if (!apiKey) {
        return jsonResponse({ error: "Missing credentials: apiKey" }, 400);
      }

      try {
        const res = await fetch(`https://monitoringapi.solaredge.com/sites/list?api_key=${encodeURIComponent(apiKey)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`SolarEdge API error ${res.status}: ${text.slice(0, 200)}`);
        }
        await res.json();
      } catch (err) {
        const integration = await upsertIntegration(ctx, {
          status: "error",
          sync_error: (err as Error).message?.slice(0, 500) || "Validation failed",
          credentials: { apiKey },
          tokens: {},
        });
        await auditLog(ctx, "monitoring.integration.error", integration?.id, { provider, error: (err as Error).message });
        return jsonResponse({ error: `SolarEdge validation failed: ${(err as Error).message}` }, 400);
      }

      const integration = await upsertIntegration(ctx, {
        status: "connected",
        sync_error: null,
        credentials: { apiKey },
        tokens: {},
      });
      await auditLog(ctx, "monitoring.integration.connected", integration?.id, { provider, status: "connected" });
      return jsonResponse({ success: true, integration_id: integration?.id, status: "connected" });
    }

    return jsonResponse({ error: `Unsupported provider: ${provider}` }, 400);
  } catch (err) {
    console.error("monitoring-connect error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
