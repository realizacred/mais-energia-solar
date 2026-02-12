/**
 * Send Web Push notifications.
 * Called internally by process-webhook-events after an inbound message.
 * Uses VAPID keys for authentication with push services.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      conversationId,
      tenantId,
      instanceId,
      contactName,
      messagePreview,
      messageId,
      direction,
    } = body;

    // Only send for inbound messages
    if (direction !== "in") {
      return new Response(JSON.stringify({ skipped: "outbound" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversationId || !tenantId) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation details to find assigned user
    const { data: conversation } = await supabase
      .from("wa_conversations")
      .select("assigned_to, instance_id")
      .eq("id", conversationId)
      .single();

    // Find target users for this notification
    // If assigned_to exists, only notify that user
    // Otherwise, notify all admins/gerentes of the tenant
    let targetUserIds: string[] = [];

    if (conversation?.assigned_to) {
      targetUserIds = [conversation.assigned_to];
    } else {
      // Get all admin/gerente users for this tenant
      const { data: adminUsers } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .eq("ativo", true);

      if (adminUsers) {
        const userIds = adminUsers.map((u: any) => u.user_id);
        // Filter to users with admin roles
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("user_id", userIds)
          .in("role", ["admin", "gerente"]);

        if (roles) {
          targetUserIds = roles.map((r: any) => r.user_id);
        }
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ skipped: "no_targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user preferences (enabled + quiet hours)
    const { data: preferences } = await supabase
      .from("push_preferences")
      .select("user_id, enabled, quiet_hours_start, quiet_hours_end")
      .in("user_id", targetUserIds);

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`;

    const enabledUserIds = targetUserIds.filter((uid) => {
      const pref = preferences?.find((p: any) => p.user_id === uid);
      if (!pref) return true; // No preferences = enabled by default
      if (!pref.enabled) return false;

      // Check quiet hours
      if (pref.quiet_hours_start && pref.quiet_hours_end) {
        const start = pref.quiet_hours_start;
        const end = pref.quiet_hours_end;
        if (start > end) {
          // Crosses midnight (e.g., 22:00 - 08:00)
          if (currentTime >= start || currentTime < end) return false;
        } else {
          if (currentTime >= start && currentTime < end) return false;
        }
      }
      return true;
    });

    if (enabledUserIds.length === 0) {
      return new Response(JSON.stringify({ skipped: "all_disabled_or_quiet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check muted conversations
    const { data: muted } = await supabase
      .from("push_muted_conversations")
      .select("user_id, muted_until")
      .eq("conversation_id", conversationId)
      .in("user_id", enabledUserIds);

    const unmutedUserIds = enabledUserIds.filter((uid) => {
      const mute = muted?.find((m: any) => m.user_id === uid);
      if (!mute) return true;
      if (mute.muted_until && new Date(mute.muted_until) < now) return true;
      return false;
    });

    if (unmutedUserIds.length === 0) {
      return new Response(JSON.stringify({ skipped: "all_muted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active subscriptions for target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, tenant_id")
      .in("user_id", unmutedUserIds)
      .eq("is_active", true)
      .eq("tenant_id", tenantId);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ skipped: "no_subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup: check if we already sent for this messageId
    if (messageId) {
      const subIds = subscriptions.map((s: any) => s.id);
      const { data: alreadySent } = await supabase
        .from("push_sent_log")
        .select("subscription_id")
        .eq("message_id", messageId)
        .in("subscription_id", subIds);

      const alreadySentIds = new Set((alreadySent || []).map((a: any) => a.subscription_id));
      const toSend = subscriptions.filter((s: any) => !alreadySentIds.has(s.id));

      if (toSend.length === 0) {
        return new Response(JSON.stringify({ skipped: "already_sent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send and log
      const results = await sendPushToSubscriptions(
        toSend,
        { conversationId, contactName, messagePreview, instanceId },
        supabase,
        messageId
      );

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No messageId — send without dedup
    const results = await sendPushToSubscriptions(
      subscriptions,
      { conversationId, contactName, messagePreview, instanceId },
      supabase,
      null
    );

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-push-notification] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── VAPID + Web Push Implementation ──

async function sendPushToSubscriptions(
  subscriptions: any[],
  payload: { conversationId: string; contactName: string; messagePreview: string; instanceId?: string },
  supabase: any,
  messageId: string | null
) {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("[send-push-notification] VAPID keys not configured");
    return { error: "VAPID keys not configured", sent: 0 };
  }

  const tenantIdForLog = subscriptions[0]?.tenant_id || null;

  const notificationPayload = JSON.stringify({
    title: `💬 ${payload.contactName || "Nova mensagem"}`,
    body: payload.messagePreview || "Nova mensagem recebida",
    conversationId: payload.conversationId,
    contactName: payload.contactName,
    instanceId: payload.instanceId,
    tag: `wa-${payload.conversationId}`,
  });

  let sent = 0;
  let failed = 0;
  const deactivated: string[] = [];

  for (const sub of subscriptions) {
    try {
      const success = await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notificationPayload,
        vapidPublicKey,
        vapidPrivateKey
      );

      if (success) {
        sent++;
        // Log dedup
        if (messageId) {
          await supabase
            .from("push_sent_log")
            .insert({ message_id: messageId, subscription_id: sub.id, tenant_id: tenantIdForLog })
            .catch(() => {}); // ignore dedup conflicts
        }
      } else {
        failed++;
        // Deactivate expired subscription
        deactivated.push(sub.id);
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", sub.id);
      }
    } catch (e) {
      console.warn(`[send-push-notification] Failed for sub ${sub.id}:`, e);
      failed++;
    }
  }

  console.log(`[send-push-notification] Sent: ${sent}, Failed: ${failed}, Deactivated: ${deactivated.length}`);
  return { sent, failed, deactivated: deactivated.length };
}

/**
 * Send a Web Push notification using the Web Push protocol.
 * Uses ECDSA P-256 for VAPID JWT signing.
 */
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;

  // Create VAPID JWT
  const jwt = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);

  // Encrypt payload using Web Push encryption (aes128gcm)
  const encrypted = await encryptPayload(
    payload,
    subscription.keys.p256dh,
    subscription.keys.auth
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: encrypted,
  });

  if (response.status === 201 || response.status === 200) {
    return true;
  }

  if (response.status === 410 || response.status === 404) {
    // Subscription expired
    console.log(`[send-push-notification] Subscription expired: ${response.status}`);
    return false;
  }

  const errText = await response.text().catch(() => "");
  console.warn(`[send-push-notification] Push failed [${response.status}]: ${errText.substring(0, 200)}`);

  // 429 = rate limited, don't deactivate
  if (response.status === 429) return true;

  return response.status < 500; // Don't deactivate on server errors
}

// ── VAPID JWT Creation ──

async function createVapidJwt(
  audience: string,
  publicKey: string,
  privateKeyBase64: string
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: "mailto:push@maisenergiasolar.com",
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const claimsB64 = base64urlEncode(JSON.stringify(claims));
  const unsigned = `${headerB64}.${claimsB64}`;

  // Import private key
  const privateKeyBytes = base64urlDecode(privateKeyBase64);
  const publicKeyBytes = base64urlDecode(publicKey);

  // Build JWK from raw coordinates
  const x = base64urlEncodeBytes(publicKeyBytes.slice(1, 33));
  const y = base64urlEncodeBytes(publicKeyBytes.slice(33, 65));
  const d = base64urlEncodeBytes(privateKeyBytes);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsigned)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);

  return `${unsigned}.${base64urlEncodeBytes(rawSig)}`;
}

// ── Web Push Encryption (aes128gcm) ──

async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<Uint8Array> {
  const clientPublicKey = base64urlDecode(p256dhBase64);
  const clientAuth = base64urlDecode(authBase64);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeys.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeys.privateKey,
      256
    )
  );

  // HKDF for auth secret
  const authInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKeyRaw
  );

  const ikm = await hkdf(clientAuth, sharedSecret, authInfo, 32);

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive content encryption key and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Encrypt with AES-128-GCM
  const paddedPayload = concatBytes(new TextEncoder().encode(payload), new Uint8Array([2]));

  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, paddedPayload)
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKeyRaw.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = serverPublicKeyRaw.length;
  header.set(serverPublicKeyRaw, 21);

  return concatBytes(header, encrypted);
}

// ── Crypto Helpers ──

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));

  // Actually do proper HKDF
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prk.length ? prk : await crypto.subtle.sign("HMAC", key, new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // HKDF-Extract
  const saltKey = await crypto.subtle.importKey(
    "raw",
    salt.length ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prkFinal = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));

  // HKDF-Expand
  const expandKey = await crypto.subtle.importKey(
    "raw",
    prkFinal,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const infoWithCounter = concatBytes(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, infoWithCounter));

  return okm.slice(0, length);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlEncodeBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER signature format: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
  const raw = new Uint8Array(64);
  let offset = 2; // skip 0x30 and length

  // R
  const rLen = der[offset + 1];
  offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen > 32 ? 0 : 32 - rLen;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rDest);
  offset += rLen;

  // S
  const sLen = der[offset + 1];
  offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen > 32 ? 32 : 32 + (32 - sLen);
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), sDest);

  return raw;
}
