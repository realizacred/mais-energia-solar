import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── Helpers ─────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getCallbackUrl(): string {
  const appUrl = Deno.env.get("APP_URL") || Deno.env.get("APP_URL_LOCKED") || "";
  return `${appUrl}/admin/integracoes`;
}

async function resolveUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Invalid token");

  const userId = user.id;

  // Resolve tenant
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  return { userId, tenantId: profile.tenant_id, adminClient };
}

/** Get per-tenant OAuth credentials from integrations table */
async function getTenantOAuthCreds(adminClient: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await adminClient
    .from("integrations")
    .select("oauth_client_id, oauth_client_secret_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  const clientId = data?.oauth_client_id;
  const clientSecret = data?.oauth_client_secret_encrypted;

  if (!clientId || !clientSecret) {
    // Fallback to env vars
    const envId = Deno.env.get("GOOGLE_CLIENT_ID");
    const envSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (envId && envSecret) return { clientId: envId, clientSecret: envSecret };
    return null;
  }

  return { clientId, clientSecret };
}

async function auditLog(
  adminClient: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    integrationId?: string;
    actorId?: string;
    action: string;
    result: string;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await adminClient.from("integration_audit_events").insert({
    tenant_id: params.tenantId,
    integration_id: params.integrationId || null,
    actor_type: params.actorId ? "user" : "system",
    actor_id: params.actorId || null,
    action: params.action,
    result: params.result,
    ip: params.ip || null,
    user_agent: params.userAgent || null,
    metadata_json: params.metadata || {},
  });
}

// ── SAVE CONFIG: Store OAuth credentials per tenant ─────────

async function handleSaveConfig(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const body = await req.json();
  const { client_id, client_secret } = body;

  if (!client_id) return json({ error: "client_id obrigatório" }, 400);
  if (!client_secret) return json({ error: "client_secret obrigatório" }, 400);

  // Ensure integration row exists
  const { data: existing } = await adminClient
    .from("integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  if (!existing) {
    await adminClient.from("integrations").insert({
      tenant_id: tenantId,
      provider: "google_calendar",
      status: "disconnected",
      oauth_client_id: client_id,
      oauth_client_secret_encrypted: client_secret,
    });
  } else {
    await adminClient
      .from("integrations")
      .update({
        oauth_client_id: client_id,
        oauth_client_secret_encrypted: client_secret,
      })
      .eq("id", existing.id);
  }

  await auditLog(adminClient, {
    tenantId,
    integrationId: existing?.id,
    actorId: userId,
    action: "config_saved",
    result: "success",
    ip: req.headers.get("x-forwarded-for") || "",
    userAgent: req.headers.get("user-agent") || "",
    metadata: { client_id_set: true, client_secret_set: true },
  });

  return json({ success: true });
}

// ── GET CONFIG: Return client_id and client_secret ──────────

async function handleGetConfig(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);

  const { data } = await adminClient
    .from("integrations")
    .select("oauth_client_id, oauth_client_secret_encrypted")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  return json({
    client_id: data?.oauth_client_id || "",
    client_secret: data?.oauth_client_secret_encrypted || "",
  });
}

// ── CONNECT: Start OAuth flow ───────────────────────────────

async function handleConnect(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const ip = req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";

  const creds = await getTenantOAuthCreds(adminClient, tenantId);
  if (!creds) {
    return json({ error: "Configure o Client ID e Client Secret antes de conectar." }, 400);
  }

  // Check for existing active integration
  const { data: existing } = await adminClient
    .from("integrations")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  // Allow reauthorization even if connected (user may want to refresh tokens)

  // Build state token
  const state = btoa(JSON.stringify({ tenantId, userId }));
  const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Ensure integration row exists
  if (!existing) {
    await adminClient.from("integrations").insert({
      tenant_id: tenantId,
      provider: "google_calendar",
      status: "disconnected",
    });
  }

  const { data: intRow } = await adminClient
    .from("integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  await auditLog(adminClient, {
    tenantId,
    integrationId: intRow?.id,
    actorId: userId,
    action: "connect_started",
    result: "success",
    ip,
    userAgent: ua,
    metadata: { scopes: SCOPES },
  });

  return json({ auth_url: authUrl });
}

// ── CALLBACK: Receive OAuth code ────────────────────────────

async function handleCallback(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (errorParam || !code || !stateParam) {
    const redirectUrl = getCallbackUrl();
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${redirectUrl}?error=${errorParam || "missing_code"}` },
    });
  }

  let tenantId: string, userId: string;
  try {
    const parsed = JSON.parse(atob(stateParam));
    tenantId = parsed.tenantId;
    userId = parsed.userId;
  } catch {
    return json({ error: "Invalid state" }, 400);
  }

  // Get per-tenant credentials
  const creds = await getTenantOAuthCreds(adminClient, tenantId);
  if (!creds) {
    const redirectUrl = getCallbackUrl();
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${redirectUrl}?error=missing_credentials` },
    });
  }

  const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    const { data: intRow } = await adminClient
      .from("integrations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_calendar")
      .single();

    await adminClient
      .from("integrations")
      .update({ status: "error", last_error_code: "token_exchange_failed", last_error_message: tokenData.error_description || "Token exchange failed" })
      .eq("tenant_id", tenantId)
      .eq("provider", "google_calendar");

    await auditLog(adminClient, {
      tenantId,
      integrationId: intRow?.id,
      actorId: userId,
      action: "callback_received",
      result: "fail",
      metadata: { error: tokenData.error_description || "token_exchange_failed" },
    });

    const redirectUrl = getCallbackUrl();
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${redirectUrl}?error=token_exchange_failed` },
    });
  }

  // Get user email from Google
  let email = "";
  try {
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    email = userInfo.email || "";
  } catch { /* non-critical */ }

  // Update integration
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  await adminClient
    .from("integrations")
    .update({
      status: "connected",
      connected_account_email: email,
      scopes: SCOPES,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar");

  const { data: intRow } = await adminClient
    .from("integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  if (intRow) {
    await adminClient
      .from("integration_credentials")
      .delete()
      .eq("integration_id", intRow.id);

    await adminClient
      .from("integration_credentials")
      .insert({
        tenant_id: tenantId,
        integration_id: intRow.id,
        access_token_encrypted: tokenData.access_token,
        refresh_token_encrypted: tokenData.refresh_token || null,
        expires_at: expiresAt,
        token_type: tokenData.token_type || "Bearer",
      });

    await auditLog(adminClient, {
      tenantId,
      integrationId: intRow.id,
      actorId: userId,
      action: "connect_completed",
      result: "success",
      metadata: { email, scopes: SCOPES },
    });
  }

  const redirectUrl = getCallbackUrl();
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: `${redirectUrl}?connected=true` },
  });
}

// ── TEST: Test connection by listing calendars ──────────────

async function handleTest(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const ip = req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";

  const { data: intRow } = await adminClient
    .from("integrations")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  if (!intRow || intRow.status === "disconnected") {
    return json({ error: "Integração não conectada" }, 400);
  }

  const accessToken = await getValidAccessToken(adminClient, intRow.id, tenantId);
  if (!accessToken) {
    await adminClient
      .from("integrations")
      .update({ status: "expired", last_test_at: new Date().toISOString(), last_test_status: "fail", last_error_code: "token_expired", last_error_message: "Não foi possível obter token válido" })
      .eq("id", intRow.id);

    await auditLog(adminClient, {
      tenantId, integrationId: intRow.id, actorId: userId,
      action: "test_fail", result: "fail", ip, userAgent: ua,
      metadata: { reason: "token_expired" },
    });

    return json({ success: false, error: "Token expirado. Reconecte a integração." });
  }

  try {
    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) {
      const errBody = await calRes.text();
      await adminClient
        .from("integrations")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: "fail",
          last_error_code: `http_${calRes.status}`,
          last_error_message: errBody.slice(0, 500),
          status: calRes.status === 401 ? "expired" : "error",
        })
        .eq("id", intRow.id);

      await auditLog(adminClient, {
        tenantId, integrationId: intRow.id, actorId: userId,
        action: "test_fail", result: "fail", ip, userAgent: ua,
        metadata: { http_status: calRes.status },
      });

      return json({ success: false, error: "Falha ao listar calendários" });
    }

    const calData = await calRes.json();
    const calendars = (calData.items || []).map((c: any) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary || false,
    }));

    await adminClient
      .from("integrations")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: "success",
        status: "connected",
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", intRow.id);

    await auditLog(adminClient, {
      tenantId, integrationId: intRow.id, actorId: userId,
      action: "test_success", result: "success", ip, userAgent: ua,
      metadata: { calendars_count: calendars.length },
    });

    return json({ success: true, calendars });
  } catch (err: any) {
    await auditLog(adminClient, {
      tenantId, integrationId: intRow.id, actorId: userId,
      action: "test_fail", result: "fail", ip, userAgent: ua,
      metadata: { error: err.message },
    });

    return json({ success: false, error: err.message }, 500);
  }
}

// ── SELECT CALENDAR ─────────────────────────────────────────

async function handleSelectCalendar(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const body = await req.json();
  const { calendar_id, calendar_name } = body;

  if (!calendar_id) return json({ error: "calendar_id obrigatório" }, 400);

  await adminClient
    .from("integrations")
    .update({ default_calendar_id: calendar_id, default_calendar_name: calendar_name || null })
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar");

  return json({ success: true });
}

// ── DISCONNECT ──────────────────────────────────────────────

async function handleDisconnect(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const ip = req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";

  const { data: intRow } = await adminClient
    .from("integrations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  if (!intRow) return json({ error: "Integração não encontrada" }, 404);

  const { data: cred } = await adminClient
    .from("integration_credentials")
    .select("access_token_encrypted")
    .eq("integration_id", intRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (cred?.access_token_encrypted) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${cred.access_token_encrypted}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch { /* best effort */ }
  }

  await adminClient
    .from("integration_credentials")
    .delete()
    .eq("integration_id", intRow.id);

  await adminClient
    .from("integrations")
    .update({
      status: "disconnected",
      connected_account_email: null,
      default_calendar_id: null,
      default_calendar_name: null,
      scopes: null,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", intRow.id);

  await auditLog(adminClient, {
    tenantId, integrationId: intRow.id, actorId: userId,
    action: "disconnect", result: "success", ip, userAgent: ua,
  });

  return json({ success: true });
}

// ── STATUS ──────────────────────────────────────────────────

async function handleStatus(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);

  const { data: intRow } = await adminClient
    .from("integrations")
    .select("id, status, connected_account_email, default_calendar_id, default_calendar_name, scopes, last_test_at, last_test_status, last_error_code, last_error_message, oauth_client_id, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("provider", "google_calendar")
    .single();

  if (!intRow) {
    return json({
      status: "disconnected",
      provider: "google_calendar",
      connected_account_email: null,
      default_calendar_id: null,
      default_calendar_name: null,
      scopes: [],
      last_test_at: null,
      last_test_status: null,
      has_credentials: false,
    });
  }

  // Never return the secret, only whether it's configured
  return json({
    ...intRow,
    has_credentials: !!intRow.oauth_client_id,
    oauth_client_secret_encrypted: undefined, // never leak
  });
}

// ── AUDIT LOG LIST ──────────────────────────────────────────

async function handleAuditLog(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);

  const { data: events } = await adminClient
    .from("integration_audit_events")
    .select("id, action, result, actor_type, created_at, metadata_json")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  return json({ events: events || [] });
}

// ── TOKEN REFRESH HELPER ────────────────────────────────────

async function getValidAccessToken(
  adminClient: ReturnType<typeof createClient>,
  integrationId: string,
  tenantId: string
): Promise<string | null> {
  const { data: cred } = await adminClient
    .from("integration_credentials")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!cred) return null;

  if (cred.expires_at && new Date(cred.expires_at) > new Date(Date.now() + 60_000)) {
    return cred.access_token_encrypted;
  }

  if (!cred.refresh_token_encrypted) return null;

  // Get per-tenant OAuth creds for refresh
  const oauthCreds = await getTenantOAuthCreds(adminClient, tenantId);
  if (!oauthCreds) return null;

  try {
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: oauthCreds.clientId,
        client_secret: oauthCreds.clientSecret,
        refresh_token: cred.refresh_token_encrypted,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) return null;

    const newExpires = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

    await adminClient
      .from("integration_credentials")
      .update({
        access_token_encrypted: refreshData.access_token,
        expires_at: newExpires,
        rotated_at: new Date().toISOString(),
      })
      .eq("id", cred.id);

    await auditLog(adminClient, {
      tenantId,
      integrationId,
      action: "token_refreshed",
      result: "success",
    });

    return refreshData.access_token;
  } catch {
    return null;
  }
}

// ── INIT: Combined status + config + audit in one call ──────

async function handleInit(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);

  // Run all 3 queries in parallel
  const [statusResult, configResult, auditResult] = await Promise.all([
    adminClient
      .from("integrations")
      .select("id, status, connected_account_email, default_calendar_id, default_calendar_name, scopes, last_test_at, last_test_status, last_error_code, last_error_message, oauth_client_id, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_calendar")
      .single(),
    adminClient
      .from("integrations")
      .select("oauth_client_id, oauth_client_secret_encrypted")
      .eq("tenant_id", tenantId)
      .eq("provider", "google_calendar")
      .single(),
    adminClient
      .from("integration_audit_events")
      .select("id, action, result, actor_type, created_at, metadata_json")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const intRow = statusResult.data;
  const statusData = intRow
    ? { ...intRow, has_credentials: !!intRow.oauth_client_id, oauth_client_secret_encrypted: undefined }
    : { status: "disconnected", provider: "google_calendar", connected_account_email: null, default_calendar_id: null, default_calendar_name: null, scopes: [], last_test_at: null, last_test_status: null, has_credentials: false };

  const configData = {
    client_id: configResult.data?.oauth_client_id || "",
    client_secret: configResult.data?.oauth_client_secret_encrypted || "",
  };

  return json({
    status: statusData,
    config: configData,
    events: auditResult.data || [],
  });
}

// ── ROUTER ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  try {
    if (action === "callback" && req.method === "GET") {
      return await handleCallback(req);
    }

    switch (action) {
      case "connect":
        return await handleConnect(req);
      case "test":
        return await handleTest(req);
      case "select-calendar":
        return await handleSelectCalendar(req);
      case "disconnect":
        return await handleDisconnect(req);
      case "status":
        return await handleStatus(req);
      case "audit-log":
        return await handleAuditLog(req);
      case "save-config":
        return await handleSaveConfig(req);
      case "get-config":
        return await handleGetConfig(req);
      case "init":
        return await handleInit(req);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("[google-calendar-integration]", err.message);
    if (err.message === "Unauthorized" || err.message === "Invalid token") {
      return json({ error: "Não autenticado" }, 401);
    }
    return json({ error: err.message }, 500);
  }
});
