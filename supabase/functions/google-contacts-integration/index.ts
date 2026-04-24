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
const APP_URL_LOCKED = Deno.env.get("APP_URL_LOCKED") || Deno.env.get("APP_URL") || "";

const PROVIDER = "google_contacts";
const SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── HMAC State Signing ──────────────────────────────────────

async function signState(payload: Record<string, unknown>): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(OAUTH_STATE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${payloadB64}.${sigHex}`;
}

async function verifyAndParseState(state: string): Promise<Record<string, unknown> | null> {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const payloadB64 = state.substring(0, dotIndex);
  const sigHex = state.substring(dotIndex + 1);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(OAUTH_STATE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payloadB64));
  if (!valid) return null;
  try {
    const parsed = JSON.parse(atob(payloadB64));
    if (parsed.ts && Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

// ── AES-256-GCM Encryption ──────────────────────────────────

const ENC_PREFIX = "enc:";

async function getEncryptionKey(): Promise<CryptoKey> {
  if (!MASTER_ENCRYPTION_KEY) throw new Error("MASTER_ENCRYPTION_KEY not configured");
  const keyMaterial = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(MASTER_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return ENC_PREFIX + uint8ToBase64(combined);
}

async function decryptToken(encrypted: string): Promise<string> {
  const b64 = encrypted.startsWith(ENC_PREFIX) ? encrypted.slice(ENC_PREFIX.length) : encrypted;
  const key = await getEncryptionKey();
  const combined = base64ToUint8(b64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

async function safeDecryptToken(value: string | null): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith(ENC_PREFIX)) return await decryptToken(value);
  return value;
}

// ── Helpers ─────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function getCallbackUrl(): string {
  // ALWAYS use the locked URL — never accept redirect_uri from client
  if (APP_URL_LOCKED) return `${APP_URL_LOCKED}/oauth/google-contacts/callback`;
  return `${SUPABASE_URL}/functions/v1/google-contacts-integration?action=callback`;
}

async function resolveUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error("Invalid token");
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await adminClient.from("profiles").select("tenant_id").eq("user_id", user.id).single();
  if (!profile?.tenant_id) throw new Error("No tenant");
  return { userId: user.id, tenantId: profile.tenant_id, adminClient };
}

async function logEvent(adminClient: ReturnType<typeof createClient>, params: {
  tenantId: string; userId?: string; action: string; status: string;
  request?: unknown; response?: unknown; errorMessage?: string;
  itemsProcessed?: number; itemsCreated?: number; itemsUpdated?: number; itemsSkipped?: number;
}) {
  await adminClient.from("integration_events").insert({
    tenant_id: params.tenantId,
    user_id: params.userId || null,
    provider: PROVIDER,
    action: params.action,
    status: params.status,
    request: params.request ? JSON.parse(JSON.stringify(params.request)) : null,
    response: params.response ? JSON.parse(JSON.stringify(params.response)) : null,
    error_message: params.errorMessage || null,
    items_processed: params.itemsProcessed || 0,
    items_created: params.itemsCreated || 0,
    items_updated: params.itemsUpdated || 0,
    items_skipped: params.itemsSkipped || 0,
  });
}

// ── Token management ──

async function getOrCreateIntegration(adminClient: ReturnType<typeof createClient>, tenantId: string) {
  const { data } = await adminClient.from("integrations")
    .select("id, status, connected_account_email, scopes, metadata")
    .eq("tenant_id", tenantId).eq("provider", PROVIDER).single();
  if (data) return data;
  const { data: created } = await adminClient.from("integrations")
    .insert({ tenant_id: tenantId, provider: PROVIDER, status: "disconnected" })
    .select("id, status, connected_account_email, scopes, metadata").single();
  return created;
}

async function getValidAccessToken(adminClient: ReturnType<typeof createClient>, integrationId: string, tenantId: string): Promise<string | null> {
  const { data: cred } = await adminClient.from("integration_credentials")
    .select("*").eq("integration_id", integrationId).order("created_at", { ascending: false }).limit(1).single();
  if (!cred) return null;

  if (cred.expires_at && new Date(cred.expires_at) > new Date(Date.now() + 60_000)) {
    return await safeDecryptToken(cred.access_token_encrypted);
  }

  const refreshToken = await safeDecryptToken(cred.refresh_token_encrypted);
  if (!refreshToken) return null;

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return null;

    const newExpires = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
    const encNew = await encryptToken(data.access_token);
    await adminClient.from("integration_credentials").update({ access_token_encrypted: encNew, expires_at: newExpires, rotated_at: new Date().toISOString() }).eq("id", cred.id);
    await logEvent(adminClient, { tenantId, action: "token_refresh", status: "success" });
    return data.access_token;
  } catch { return null; }
}

// ── Phone normalization ─────────────────────────────────────

function normalizePhoneE164(raw: string): string {
  const cleaned = raw.replace(/[^0-9+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length >= 10 && cleaned.length <= 11) return "+55" + cleaned;
  if (cleaned.length >= 12 && cleaned.length <= 13 && cleaned.startsWith("55")) return "+" + cleaned;
  return "+" + cleaned;
}

// ── CONNECT: Start OAuth ────────────────────────────────────

async function handleConnect(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  if (!clientId) return json({ error: "GOOGLE_CLIENT_ID não configurado" }, 500);

  await getOrCreateIntegration(adminClient, tenantId);

  // Always use locked callback URL — never trust client origin
  const callbackUrl = getCallbackUrl();
  const state = await signState({ tenantId, userId, provider: PROVIDER, ts: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state,
  });

  await logEvent(adminClient, { tenantId, userId, action: "oauth_connect_start", status: "success" });
  return json({ auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

// ── CALLBACK PROXY (from frontend) ──────────────────────────

async function handleCallbackProxy(req: Request) {
  const body = await req.json();
  const { code, state: stateParam } = body;
  // NOTE: redirect_uri from client is IGNORED — we always use APP_URL_LOCKED
  if (!code || !stateParam) return json({ error: "missing code or state" }, 400);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const parsed = await verifyAndParseState(stateParam);
  if (!parsed || !parsed.tenantId || !parsed.userId) return json({ error: "Invalid or expired state" }, 403);

  const tenantId = parsed.tenantId as string;
  const userId = parsed.userId as string;

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return json({ error: "Google credentials not configured" }, 500);

  // Always use locked callback URL for token exchange
  const callbackUrl = getCallbackUrl();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: callbackUrl, grant_type: "authorization_code" }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    await logEvent(adminClient, { tenantId, userId, action: "oauth_connect", status: "fail", errorMessage: tokenData.error_description || "token_exchange_failed" });
    return json({ error: tokenData.error_description || "token_exchange_failed" }, 400);
  }

  // Get email
  let email = "";
  try {
    const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const ui = await uiRes.json();
    email = ui.email || "";
  } catch {}

  const integration = await getOrCreateIntegration(adminClient, tenantId);
  if (!integration) return json({ error: "Failed to create integration" }, 500);

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

  await adminClient.from("integrations").update({
    status: "connected",
    connected_account_email: email,
    scopes: SCOPES,
    last_error_code: null,
    last_error_message: null,
    metadata: { push_on_save: false, last_sync_at: null },
  }).eq("id", integration.id);

  await adminClient.from("integration_credentials").delete().eq("integration_id", integration.id);
  const encAccess = await encryptToken(tokenData.access_token);
  const encRefresh = tokenData.refresh_token ? await encryptToken(tokenData.refresh_token) : null;
  await adminClient.from("integration_credentials").insert({
    tenant_id: tenantId,
    integration_id: integration.id,
    access_token_encrypted: encAccess,
    refresh_token_encrypted: encRefresh,
    expires_at: expiresAt,
    token_type: tokenData.token_type || "Bearer",
  });

  await logEvent(adminClient, { tenantId, userId, action: "oauth_connect", status: "success", response: { email, scopes: SCOPES } });
  return json({ success: true, email });
}

// ── STATUS ──────────────────────────────────────────────────

async function handleStatus(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);
  const { data: intRow } = await adminClient.from("integrations")
    .select("id, status, connected_account_email, scopes, metadata, last_error_code, last_error_message, created_at, updated_at")
    .eq("tenant_id", tenantId).eq("provider", PROVIDER).single();

  if (!intRow) return json({ status: "disconnected", provider: PROVIDER, settings: {} });

  return json({
    ...intRow,
    settings: intRow.metadata || {},
    provider: PROVIDER,
  });
}

// ── UPDATE SETTINGS ─────────────────────────────────────────

async function handleUpdateSettings(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);
  const body = await req.json();
  const { push_on_save } = body;

  const { data: intRow } = await adminClient.from("integrations")
    .select("id, metadata").eq("tenant_id", tenantId).eq("provider", PROVIDER).single();
  if (!intRow) return json({ error: "Integration not found" }, 404);

  const metadata = { ...(intRow.metadata as Record<string, unknown> || {}), push_on_save: !!push_on_save };
  await adminClient.from("integrations").update({ metadata }).eq("id", intRow.id);
  return json({ success: true });
}

// ── DISCONNECT ──────────────────────────────────────────────

async function handleDisconnect(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const { data: intRow } = await adminClient.from("integrations").select("id").eq("tenant_id", tenantId).eq("provider", PROVIDER).single();
  if (!intRow) return json({ error: "Not found" }, 404);

  const { data: cred } = await adminClient.from("integration_credentials")
    .select("access_token_encrypted").eq("integration_id", intRow.id).order("created_at", { ascending: false }).limit(1).single();
  if (cred?.access_token_encrypted) {
    try {
      const plain = await safeDecryptToken(cred.access_token_encrypted);
      if (plain) await fetch(`https://oauth2.googleapis.com/revoke?token=${plain}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    } catch {}
  }

  await adminClient.from("integration_credentials").delete().eq("integration_id", intRow.id);
  await adminClient.from("integrations").update({
    status: "disconnected", connected_account_email: null, scopes: null,
    last_error_code: null, last_error_message: null, metadata: {},
  }).eq("id", intRow.id);

  await logEvent(adminClient, { tenantId, userId, action: "disconnect", status: "success" });
  return json({ success: true });
}

// ── Normalize Google Person (pure, no DB calls) ────────────

interface NormalizedPerson {
  resourceName: string;
  etag: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phonesJsonb: { value: string; e164: string; label: string; is_primary: boolean }[];
  emailsJsonb: { value: string; label: string; is_primary: boolean }[];
  allIdentityValues: { type: string; value: string }[];
}

function normalizeGooglePerson(person: any): NormalizedPerson {
  const resourceName = person.resourceName;
  const etag = person.etag || null;
  const names = person.names || [];
  const phones = person.phoneNumbers || [];
  const emails = person.emailAddresses || [];
  const photos = person.photos || [];

  const displayName = names[0]?.displayName || phones[0]?.value || emails[0]?.value || "Sem nome";
  const firstName = names[0]?.givenName || null;
  const lastName = names[0]?.familyName || null;
  const avatarUrl = photos[0]?.url || null;

  const phonesJsonb = phones.map((p: any, i: number) => ({
    value: p.value, e164: normalizePhoneE164(p.value || ""), label: p.type || "other", is_primary: i === 0,
  }));
  const emailsJsonb = emails.map((e: any, i: number) => ({
    value: e.value, label: e.type || "other", is_primary: i === 0,
  }));

  // Collect all identity values for batch lookup
  const allIdentityValues: { type: string; value: string }[] = [
    { type: "google_resource", value: resourceName },
  ];
  for (const ph of phonesJsonb) {
    if (ph.e164) allIdentityValues.push({ type: "phone_e164", value: ph.e164 });
  }
  for (const em of emailsJsonb) {
    if (em.value) allIdentityValues.push({ type: "email", value: em.value.toLowerCase() });
  }

  return { resourceName, etag, displayName, firstName, lastName, avatarUrl, phonesJsonb, emailsJsonb, allIdentityValues };
}

// ── PULL SYNC: Import contacts from Google ──────────────────

async function handlePullSync(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const integration = await getOrCreateIntegration(adminClient, tenantId);
  if (!integration || integration.status !== "connected") return json({ error: "Not connected" }, 400);

  const accessToken = await getValidAccessToken(adminClient, integration.id, tenantId);
  if (!accessToken) {
    await adminClient.from("integrations").update({ status: "error", last_error_message: "Token expired" }).eq("id", integration.id);
    return json({ error: "Token expired. Reconnect." }, 401);
  }

  const stats = { processed: 0, created: 0, updated: 0, skipped: 0 };
  let nextPageToken = "";
  const PAGE_SIZE = 200;

  try {
    // Collect all persons from all pages first
    const allPersons: any[] = [];
    do {
      const url = new URL("https://people.googleapis.com/v1/people/me/connections");
      url.searchParams.set("personFields", "names,phoneNumbers,emailAddresses,photos");
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`People API error ${res.status}: ${errText.slice(0, 300)}`);
      }

      const data = await res.json();
      const connections = data.connections || [];
      allPersons.push(...connections);
      nextPageToken = data.nextPageToken || "";
    } while (nextPageToken);

    // Normalize all persons (pure, no DB calls)
    const normalized = allPersons.map(p => normalizeGooglePerson(p));
    stats.processed = normalized.length;

    if (normalized.length === 0) {
      const metadata = { ...((integration.metadata as Record<string, unknown>) || {}), last_sync_at: new Date().toISOString() };
      await adminClient.from("integrations").update({ metadata }).eq("id", integration.id);
      await logEvent(adminClient, { tenantId, userId, action: "pull_sync", status: "success", itemsProcessed: 0, itemsCreated: 0, itemsUpdated: 0, itemsSkipped: 0 });
      return json({ success: true, stats });
    }

    // AP-20 fix B: Batch-fetch ALL existing identities for this tenant in one query
    const allValues = [...new Set(normalized.flatMap(p => p.allIdentityValues.map(iv => iv.value)))];

    // Fetch in chunks of 500 to avoid query size limits
    const CHUNK = 500;
    const allExistingIdentities: any[] = [];
    for (let i = 0; i < allValues.length; i += CHUNK) {
      const chunk = allValues.slice(i, i + CHUNK);
      const { data: identities } = await adminClient.from("contact_identities")
        .select("contact_id, identity_type, identity_value")
        .eq("tenant_id", tenantId)
        .in("identity_value", chunk);
      if (identities) allExistingIdentities.push(...identities);
    }

    // Build lookup map: "type::value" → contact_id
    const identityMap = new Map<string, string>();
    for (const id of allExistingIdentities) {
      identityMap.set(`${id.identity_type}::${id.identity_value}`, id.contact_id);
    }

    // Classify each person: update existing or create new
    const contactsToUpdate: { contactId: string; person: NormalizedPerson }[] = [];
    const contactsToCreate: NormalizedPerson[] = [];

    for (const person of normalized) {
      // Match priority: google_resource → phone → email (same as original)
      let contactId = identityMap.get(`google_resource::${person.resourceName}`) || null;

      if (!contactId) {
        for (const ph of person.phonesJsonb) {
          if (!ph.e164) continue;
          contactId = identityMap.get(`phone_e164::${ph.e164}`) || null;
          if (contactId) break;
        }
      }

      if (!contactId) {
        for (const em of person.emailsJsonb) {
          if (!em.value) continue;
          contactId = identityMap.get(`email::${em.value.toLowerCase()}`) || null;
          if (contactId) break;
        }
      }

      if (contactId) {
        contactsToUpdate.push({ contactId, person });
      } else {
        contactsToCreate.push(person);
      }
    }

    // Batch UPDATE existing contacts
    // Each has different field values, so we update individually but without N+1 SELECTs
    for (const { contactId, person } of contactsToUpdate) {
      await adminClient.from("contacts").update({
        display_name: person.displayName,
        first_name: person.firstName,
        last_name: person.lastName,
        phones: person.phonesJsonb,
        emails: person.emailsJsonb,
        external_refs: { google: { resourceName: person.resourceName, etag: person.etag } },
        avatar_url: person.avatarUrl,
        source: "google",
      }).eq("id", contactId).eq("tenant_id", tenantId);
    }
    stats.updated = contactsToUpdate.length;

    // AP-20 fix C: Batch upsert identities for updated contacts
    const updateIdentities: any[] = [];
    for (const { contactId, person } of contactsToUpdate) {
      updateIdentities.push({
        tenant_id: tenantId, contact_id: contactId, identity_type: "google_resource",
        identity_value: person.resourceName, is_primary: true,
      });
      for (const ph of person.phonesJsonb) {
        if (!ph.e164) continue;
        updateIdentities.push({
          tenant_id: tenantId, contact_id: contactId, identity_type: "phone_e164",
          identity_value: ph.e164, is_primary: ph.is_primary,
        });
      }
      for (const em of person.emailsJsonb) {
        if (!em.value) continue;
        updateIdentities.push({
          tenant_id: tenantId, contact_id: contactId, identity_type: "email",
          identity_value: em.value.toLowerCase(), is_primary: em.is_primary,
        });
      }
    }
    if (updateIdentities.length > 0) {
      // Upsert in chunks to avoid payload limits
      for (let i = 0; i < updateIdentities.length; i += CHUNK) {
        const chunk = updateIdentities.slice(i, i + CHUNK);
        await adminClient.from("contact_identities")
          .upsert(chunk, { onConflict: "tenant_id,identity_type,identity_value" })
          .catch(() => {}); // Silently handle constraint conflicts (same as original)
      }
    }

    // Batch INSERT new contacts (one by one for insert to get IDs back, but no N+1 SELECT)
    // We insert individually because we need each contact's ID for identity rows
    const createIdentities: any[] = [];
    for (const person of contactsToCreate) {
      const primaryPhone = person.phonesJsonb[0]?.e164 || null;
      const { data: newContact, error } = await adminClient.from("contacts").insert({
        tenant_id: tenantId,
        display_name: person.displayName,
        name: person.displayName,
        first_name: person.firstName,
        last_name: person.lastName,
        phone_e164: primaryPhone || "unknown",
        phones: person.phonesJsonb,
        emails: person.emailsJsonb,
        roles: ["cliente"],
        source: "google",
        external_refs: { google: { resourceName: person.resourceName, etag: person.etag } },
        avatar_url: person.avatarUrl,
      }).select("id").single();

      if (error || !newContact) {
        stats.skipped++;
        continue;
      }
      stats.created++;

      // Collect identities for batch insert
      createIdentities.push({
        tenant_id: tenantId, contact_id: newContact.id, identity_type: "google_resource",
        identity_value: person.resourceName, is_primary: true,
      });
      for (const ph of person.phonesJsonb) {
        if (!ph.e164) continue;
        createIdentities.push({
          tenant_id: tenantId, contact_id: newContact.id, identity_type: "phone_e164",
          identity_value: ph.e164, is_primary: ph.is_primary,
        });
      }
      for (const em of person.emailsJsonb) {
        if (!em.value) continue;
        createIdentities.push({
          tenant_id: tenantId, contact_id: newContact.id, identity_type: "email",
          identity_value: em.value.toLowerCase(), is_primary: em.is_primary,
        });
      }
    }

    // AP-20 fix D: Batch insert identities for new contacts
    if (createIdentities.length > 0) {
      for (let i = 0; i < createIdentities.length; i += CHUNK) {
        const chunk = createIdentities.slice(i, i + CHUNK);
        await adminClient.from("contact_identities")
          .upsert(chunk, { onConflict: "tenant_id,identity_type,identity_value" })
          .catch(() => {}); // Silently handle constraint conflicts (same as original)
      }
    }

    // Remaining are skipped (already counted in create errors above)
    stats.skipped += (normalized.length - stats.updated - stats.created - stats.skipped);
    if (stats.skipped < 0) stats.skipped = 0;

    const metadata = { ...((integration.metadata as Record<string, unknown>) || {}), last_sync_at: new Date().toISOString() };
    await adminClient.from("integrations").update({ metadata }).eq("id", integration.id);

    await logEvent(adminClient, {
      tenantId, userId, action: "pull_sync", status: "success",
      itemsProcessed: stats.processed, itemsCreated: stats.created, itemsUpdated: stats.updated, itemsSkipped: stats.skipped,
    });

    return json({ success: true, stats });
  } catch (err: any) {
    await logEvent(adminClient, { tenantId, userId, action: "pull_sync", status: "fail", errorMessage: err.message });
    return json({ error: err.message }, 500);
  }
}

// ── PUSH UPSERT: Send contact to Google ─────────────────────

async function handlePushUpsert(req: Request) {
  const { userId, tenantId, adminClient } = await resolveUser(req);
  const body = await req.json();
  const { contact_id } = body;
  if (!contact_id) return json({ error: "contact_id required" }, 400);

  const integration = await getOrCreateIntegration(adminClient, tenantId);
  if (!integration || integration.status !== "connected") return json({ skipped: true, reason: "not_connected" });

  const settings = (integration.metadata as Record<string, unknown>) || {};
  if (!settings.push_on_save) return json({ skipped: true, reason: "push_on_save disabled" });

  const accessToken = await getValidAccessToken(adminClient, integration.id, tenantId);
  if (!accessToken) return json({ error: "Token expired" }, 401);

  const { data: contact } = await adminClient.from("contacts").select("*").eq("id", contact_id).eq("tenant_id", tenantId).single();
  if (!contact) return json({ error: "Contact not found" }, 404);

  const externalRefs = (contact.external_refs as Record<string, any>) || {};
  const googleRef = externalRefs.google || {};
  const resourceName = googleRef.resourceName;

  const personBody: any = {
    names: [{ givenName: contact.first_name || contact.display_name, familyName: contact.last_name || "" }],
    phoneNumbers: ((contact.phones as any[]) || []).map((p: any) => ({ value: p.value || p.e164, type: p.label || "other" })),
    emailAddresses: ((contact.emails as any[]) || []).map((e: any) => ({ value: e.value, type: e.label || "other" })),
  };

  try {
    let result: any;

    if (resourceName) {
      personBody.etag = googleRef.etag;
      const res = await fetch(`https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(personBody),
      });
      result = await res.json();
      if (!res.ok) throw new Error(`Update failed: ${JSON.stringify(result).slice(0, 300)}`);

      await adminClient.from("contacts").update({
        external_refs: { ...externalRefs, google: { resourceName, etag: result.etag } },
      }).eq("id", contact_id);
    } else {
      const res = await fetch("https://people.googleapis.com/v1/people:createContact", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(personBody),
      });
      result = await res.json();
      if (!res.ok) throw new Error(`Create failed: ${JSON.stringify(result).slice(0, 300)}`);

      const newResourceName = result.resourceName;
      await adminClient.from("contacts").update({
        external_refs: { ...externalRefs, google: { resourceName: newResourceName, etag: result.etag } },
      }).eq("id", contact_id);

      await adminClient.from("contact_identities").upsert({
        tenant_id: tenantId, contact_id, identity_type: "google_resource", identity_value: newResourceName, is_primary: true,
      }, { onConflict: "tenant_id,identity_type,identity_value" }).catch(() => {});
    }

    await logEvent(adminClient, { tenantId, userId, action: "push_upsert", status: "success", response: { resourceName: resourceName || result.resourceName } });
    return json({ success: true, resourceName: resourceName || result.resourceName });
  } catch (err: any) {
    await logEvent(adminClient, { tenantId, userId, action: "push_upsert", status: "fail", errorMessage: err.message });
    return json({ error: err.message }, 500);
  }
}

// ── EVENTS LOG ──────────────────────────────────────────────

async function handleEvents(req: Request) {
  const { tenantId, adminClient } = await resolveUser(req);
  const { data } = await adminClient.from("integration_events")
    .select("*").eq("tenant_id", tenantId).eq("provider", PROVIDER)
    .order("created_at", { ascending: false }).limit(50);
  return json({ events: data || [] });
}

// ── ROUTER ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  try {
    switch (action) {
      case "connect": return await handleConnect(req);
      case "callback-proxy": return await handleCallbackProxy(req);
      case "status": return await handleStatus(req);
      case "update-settings": return await handleUpdateSettings(req);
      case "disconnect": return await handleDisconnect(req);
      case "pull-sync": return await handlePullSync(req);
      case "push-upsert": return await handlePushUpsert(req);
      case "events": return await handleEvents(req);
      default: return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("[google-contacts-integration]", err.message);
    if (err.message === "Unauthorized" || err.message === "Invalid token") return json({ error: "Não autenticado" }, 401);
    return json({ error: err.message }, 500);
  }
});
