import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OAUTH_STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET") || "";
const MASTER_ENCRYPTION_KEY = Deno.env.get("MASTER_ENCRYPTION_KEY") || "";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── HMAC State Signing (anti-tamper) ────────────────────────

async function signState(payload: Record<string, unknown>): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OAUTH_STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  
  const sigHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  
  return `${payloadB64}.${sigHex}`;
}

async function verifyAndParseState(state: string): Promise<Record<string, unknown> | null> {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;
  
  const payloadB64 = state.substring(0, dotIndex);
  const sigHex = state.substring(dotIndex + 1);
  
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(OAUTH_STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(payloadB64)
  );
  
  if (!valid) return null;
  
  try {
    const parsed = JSON.parse(atob(payloadB64));
    
    // Check expiration (15 min max)
    if (parsed.ts && Date.now() - parsed.ts > 15 * 60 * 1000) {
      console.warn("[SECURITY] OAuth state expired");
      return null;
    }
    
    return parsed;
  } catch {
    return null;
  }
}

// ── AES-256-GCM Encryption ──────────────────────────────────

const ENC_PREFIX = "enc:";

async function getEncryptionKey(): Promise<CryptoKey> {
  if (!MASTER_ENCRYPTION_KEY) {
    throw new Error("MASTER_ENCRYPTION_KEY not configured");
  }
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(MASTER_ENCRYPTION_KEY)
  );
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Uint8Array → base64 without spread (safe for large payloads) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** base64 → Uint8Array */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encrypt plaintext → "enc:" + base64(iv + ciphertext + tag) */
async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encoded
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return ENC_PREFIX + uint8ToBase64(combined);
}

/** Decrypt "enc:"-prefixed base64 → plaintext. Throws on failure. */
async function decryptToken(encrypted: string): Promise<string> {
  const b64 = encrypted.startsWith(ENC_PREFIX) ? encrypted.slice(ENC_PREFIX.length) : encrypted;
  const key = await getEncryptionKey();
  const combined = base64ToUint8(b64);

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Smart decrypt with auto-migration:
 * - "enc:" prefix → mandatory decrypt (throws on failure)
 * - No prefix → legacy plaintext, return as-is + schedule re-encryption
 * 
 * @param migrationCtx if provided, legacy tokens are re-encrypted in-place
 */
async function safeDecryptToken(
  value: string | null,
  migrationCtx?: { adminClient: ReturnType<typeof createClient>; credId: string; field: "access_token_encrypted" | "refresh_token_encrypted" }
): Promise<string | null> {
  if (!value) return null;

  if (value.startsWith(ENC_PREFIX)) {
    // Modern encrypted token — decrypt is mandatory
    return await decryptToken(value);
  }

  // Legacy plaintext token
  console.warn("[CRYPTO] Legacy plaintext token detected, returning as-is");

  // Auto-migrate: re-encrypt and persist
  if (migrationCtx) {
    try {
      const encrypted = await encryptToken(value);
      await migrationCtx.adminClient
        .from("integration_credentials")
        .update({ [migrationCtx.field]: encrypted })
        .eq("id", migrationCtx.credId);
      console.log("[CRYPTO] Auto-migrated legacy token to AES-GCM");
    } catch (migErr) {
      console.error("[CRYPTO] Auto-migration failed (non-fatal)");
    }
  }

  return value;
}

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

function popupCloseHtml(queryString: string): string {
  const fallbackUrl = getCallbackUrl() + "?" + queryString;
  return `<!DOCTYPE html><html><head><title>Google Calendar</title></head><body>
<script>
  if (window.opener) {
    window.close();
  } else {
    window.location.href = "${fallbackUrl}";
  }
</script>
<p>Conectado! Você pode fechar esta janela.</p>
</body></html>`;
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

// ── GET CONFIG: Return client_id ONLY (secret is write-only) ─

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
    client_secret: data?.oauth_client_secret_encrypted ? "••••••••••" : "",
  });
}

// ── CONNECT: Start OAuth flow ───────────────────────────────

async function handleConnect(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const ip = req.headers.get("x-forwarded-for") || "";
  const ua = req.headers.get("user-agent") || "";

  // Accept origin from frontend to build redirect_uri using the app domain
  let frontendOrigin = "";
  try {
    const body = await req.json();
    frontendOrigin = body.origin || "";
  } catch { /* no body */ }

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

  // Build HMAC-signed state token (anti-tamper)
  const state = await signState({ tenantId, userId, origin: frontendOrigin, ts: Date.now() });
  
  // Use frontend URL as redirect_uri if origin provided, otherwise fallback to edge function URL
  const callbackUrl = frontendOrigin
    ? `${frontendOrigin}/oauth/google/callback`
    : `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;

  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
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
    return new Response(popupCloseHtml(`error=${errorParam || "missing_code"}`), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  let tenantId: string, userId: string, stateOrigin = "";
  const parsed = await verifyAndParseState(stateParam);
  if (!parsed || !parsed.tenantId || !parsed.userId) {
    console.error("[SECURITY] Invalid or tampered OAuth state in callback");
    return new Response(popupCloseHtml("error=invalid_state"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  tenantId = parsed.tenantId as string;
  userId = parsed.userId as string;
  stateOrigin = (parsed.origin as string) || "";

  // Get per-tenant credentials
  const creds = await getTenantOAuthCreds(adminClient, tenantId);
  if (!creds) {
    return new Response(popupCloseHtml("error=missing_credentials"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Must match the redirect_uri used in the connect step
  const callbackUrl = stateOrigin
    ? `${stateOrigin}/oauth/google/callback`
    : `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;

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

    return new Response(popupCloseHtml("error=token_exchange_failed"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
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

    const encAccessToken = await encryptToken(tokenData.access_token);
    const encRefreshToken = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;

    await adminClient
      .from("integration_credentials")
      .insert({
        tenant_id: tenantId,
        integration_id: intRow.id,
        access_token_encrypted: encAccessToken,
        refresh_token_encrypted: encRefreshToken,
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

  return new Response(popupCloseHtml("connected=true"), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

// ── CALLBACK-PROXY: Receive code from frontend proxy ────────

async function handleCallbackProxy(req: Request) {
  const body = await req.json();
  const { code, state: stateParam, redirect_uri: frontendRedirectUri } = body;

  if (!code || !stateParam) {
    return json({ error: "missing code or state" }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let tenantId: string, userId: string;
  const parsed = await verifyAndParseState(stateParam);
  if (!parsed || !parsed.tenantId || !parsed.userId) {
    console.error("[SECURITY] Invalid or tampered OAuth state in callback-proxy");
    return json({ error: "Invalid or expired state token" }, 403);
  }
  tenantId = parsed.tenantId as string;
  userId = parsed.userId as string;

  const creds = await getTenantOAuthCreds(adminClient, tenantId);
  if (!creds) {
    return json({ error: "missing_credentials" }, 400);
  }

  // Use the redirect_uri from frontend (must match what was used in the auth URL)
  const callbackUrl = frontendRedirectUri || `${SUPABASE_URL}/functions/v1/google-calendar-integration?action=callback`;

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
    await adminClient
      .from("integrations")
      .update({ status: "error", last_error_code: "token_exchange_failed", last_error_message: tokenData.error_description || "Token exchange failed" })
      .eq("tenant_id", tenantId)
      .eq("provider", "google_calendar");

    return json({ success: false, error: tokenData.error_description || "token_exchange_failed" }, 400);
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

    const encAccessToken2 = await encryptToken(tokenData.access_token);
    const encRefreshToken2 = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;

    await adminClient
      .from("integration_credentials")
      .insert({
        tenant_id: tenantId,
        integration_id: intRow.id,
        access_token_encrypted: encAccessToken2,
        refresh_token_encrypted: encRefreshToken2,
        expires_at: expiresAt,
        token_type: tokenData.token_type || "Bearer",
      });

    await auditLog(adminClient, {
      tenantId,
      integrationId: intRow.id,
      actorId: userId,
      action: "connect_completed",
      result: "success",
      metadata: { email, scopes: SCOPES, via: "frontend_proxy" },
    });
  }

  return json({ success: true, email });
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
    .select("id, access_token_encrypted")
    .eq("integration_id", intRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (cred?.access_token_encrypted) {
    try {
      const plainToken = await safeDecryptToken(cred.access_token_encrypted);
      if (plainToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${plainToken}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }
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
    const decrypted = await safeDecryptToken(cred.access_token_encrypted, {
      adminClient, credId: cred.id, field: "access_token_encrypted",
    });
    return decrypted;
  }

  const refreshTokenPlain = await safeDecryptToken(cred.refresh_token_encrypted, {
    adminClient, credId: cred.id, field: "refresh_token_encrypted",
  });
  if (!refreshTokenPlain) return null;

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
        refresh_token: refreshTokenPlain,
        grant_type: "refresh_token",
      }),
    });

    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) return null;

    const newExpires = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
    const encNewAccessToken = await encryptToken(refreshData.access_token);

    await adminClient
      .from("integration_credentials")
      .update({
        access_token_encrypted: encNewAccessToken,
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
    client_secret: configResult.data?.oauth_client_secret_encrypted ? "••••••••••" : "",
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
      case "callback-proxy":
        return await handleCallbackProxy(req);
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
