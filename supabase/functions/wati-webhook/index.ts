import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * WATI Webhook Handler
 * 
 * Receives webhook events from WATI and normalizes them into the same
 * canonical wa_webhook_events table used by Evolution API. The unified
 * process-webhook-events function handles all downstream logic.
 * 
 * WATI webhook URL format:
 *   POST /functions/v1/wati-webhook?instance=<instance_key>&secret=<webhook_secret>
 * 
 * WATI event types mapped:
 *   - message          → messages.upsert (inbound)
 *   - message_status   → messages.update (delivery/read)
 *   - contact_update   → contacts.upsert
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── WATI → Internal normalization ─────────────────────

interface NormalizedMessage {
  key: { id: string; remoteJid: string; fromMe: boolean; participant?: string };
  message: Record<string, unknown>;
  messageTimestamp: number;
  pushName?: string;
  body?: string;
}

interface NormalizedStatusUpdate {
  keyId: string;
  status: string; // PENDING | SERVER_ACK | DELIVERY_ACK | READ
}

/**
 * Normalize WATI inbound message into Evolution-compatible format.
 * This allows process-webhook-events to handle both providers identically.
 */
function normalizeInboundMessageWati(watiPayload: any): NormalizedMessage | null {
  // WATI sends different structures depending on message type
  const waId = watiPayload.waId || watiPayload.from || watiPayload.senderPhoneNumber;
  const wamid = watiPayload.id || watiPayload.messageId || watiPayload.wamid;
  const timestamp = watiPayload.timestamp
    ? (typeof watiPayload.timestamp === "number" ? watiPayload.timestamp : Math.floor(new Date(watiPayload.timestamp).getTime() / 1000))
    : Math.floor(Date.now() / 1000);

  if (!waId || !wamid) return null;

  // Build canonical JID
  const digits = waId.replace(/\D/g, "");
  const remoteJid = `${digits}@s.whatsapp.net`;

  const fromMe = watiPayload.owner === true || watiPayload.fromMe === true || false;
  const pushName = watiPayload.senderName || watiPayload.pushName || watiPayload.notifyName || null;

  // Normalize message content by type
  const watiType = (watiPayload.type || watiPayload.messageType || "text").toLowerCase();
  const message: Record<string, unknown> = {};

  switch (watiType) {
    case "text":
      message.conversation = watiPayload.text || watiPayload.data || watiPayload.body || "";
      break;
    case "image":
      message.imageMessage = {
        caption: watiPayload.caption || watiPayload.text || null,
        mimetype: watiPayload.mimeType || "image/jpeg",
      };
      break;
    case "video":
      message.videoMessage = {
        caption: watiPayload.caption || null,
        mimetype: watiPayload.mimeType || "video/mp4",
      };
      break;
    case "audio":
    case "voice":
    case "ptt":
      message.audioMessage = {
        mimetype: watiPayload.mimeType || "audio/ogg",
        ptt: watiType === "ptt" || watiType === "voice",
      };
      break;
    case "document":
    case "file":
      message.documentMessage = {
        fileName: watiPayload.fileName || watiPayload.filename || "document",
        mimetype: watiPayload.mimeType || "application/octet-stream",
        fileLength: watiPayload.fileSize || null,
      };
      break;
    case "location":
      message.locationMessage = {
        degreesLatitude: watiPayload.latitude || watiPayload.location?.latitude,
        degreesLongitude: watiPayload.longitude || watiPayload.location?.longitude,
      };
      break;
    case "contacts":
    case "contact":
      message.contactMessage = {};
      break;
    case "sticker":
      message.stickerMessage = { mimetype: watiPayload.mimeType || "image/webp" };
      break;
    default:
      // Unknown type — treat as text with body
      if (watiPayload.text || watiPayload.body) {
        message.conversation = watiPayload.text || watiPayload.body;
      }
  }

  const result: NormalizedMessage = {
    key: { id: wamid, remoteJid, fromMe },
    message,
    messageTimestamp: timestamp,
    pushName: pushName || undefined,
  };

  // Attach media URL if present (WATI provides direct URLs)
  if (watiPayload.data?.url || watiPayload.mediaUrl || watiPayload.url) {
    (result as any).mediaUrl = watiPayload.data?.url || watiPayload.mediaUrl || watiPayload.url;
  }

  return result;
}

/**
 * Normalize WATI status event into Evolution-compatible format.
 */
function normalizeStatusEventWati(watiPayload: any): NormalizedStatusUpdate | null {
  const wamid = watiPayload.id || watiPayload.messageId || watiPayload.wamid;
  if (!wamid) return null;

  const watiStatus = (watiPayload.status || watiPayload.eventType || "").toLowerCase();
  const statusMap: Record<string, string> = {
    sent: "SERVER_ACK",
    delivered: "DELIVERY_ACK",
    read: "READ",
    failed: "PENDING", // will be caught as error downstream
    pending: "PENDING",
  };

  const mapped = statusMap[watiStatus];
  if (!mapped) return null;

  return { keyId: wamid, status: mapped };
}

/**
 * Normalize outbound payload for WATI API.
 * Used by send-whatsapp-message when modo_envio includes "wati".
 */
export function normalizeOutboundPayloadWati(phone: string, text: string): {
  endpoint: string;
  body: Record<string, unknown>;
} {
  // WATI API uses /api/v1/sendSessionMessage/{phone}
  const digits = phone.replace(/\D/g, "");
  return {
    endpoint: `/api/v1/sendSessionMessage/${digits}`,
    body: { messageText: text },
  };
}

/**
 * Resolve WATI provider message ID from webhook payload.
 */
function resolveProviderMessageIdWati(payload: any): string | null {
  return payload.id || payload.messageId || payload.wamid || null;
}

/**
 * Resolve remote JID from WATI payload.
 */
function resolveRemoteJidWati(payload: any): string | null {
  const waId = payload.waId || payload.from || payload.senderPhoneNumber;
  if (!waId) return null;
  const digits = waId.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

// ── Main webhook handler ──────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = Date.now();

  try {
    const url = new URL(req.url);
    const instanceKey = url.searchParams.get("instance");
    const webhookSecret = url.searchParams.get("secret");

    // Rate limiting
    const identifier = instanceKey || req.headers.get("x-forwarded-for") || "unknown";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _function_name: "wati-webhook",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 120,
    });
    if (allowed === false) {
      console.warn(`[wati-webhook] Rate limited: ${identifier}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    if (!instanceKey) {
      return new Response(JSON.stringify({ error: "Missing instance key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const watiEventType = (body.event || body.eventType || body.type || "message").toLowerCase();

    // Resolve instance (same strategy as evolution-webhook)
    let instance: { id: string; tenant_id: string; webhook_secret: string | null } | null = null;

    const { data: byKey } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, webhook_secret")
      .eq("evolution_instance_key", instanceKey)
      .maybeSingle();
    if (byKey) instance = byKey;

    if (!instance && webhookSecret) {
      const { data: bySecret } = await supabase
        .from("wa_instances")
        .select("id, tenant_id, webhook_secret")
        .eq("webhook_secret", webhookSecret)
        .maybeSingle();
      if (bySecret) instance = bySecret;
    }

    if (!instance) {
      console.error(`[wati-webhook] Instance not found: ${instanceKey}`);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant status check
    const { data: tenantCheck } = await supabase
      .from("tenants")
      .select("status, deleted_at")
      .eq("id", instance.tenant_id)
      .single();
    if (!tenantCheck || tenantCheck.status !== "active" || tenantCheck.deleted_at) {
      return new Response(JSON.stringify({ error: "tenant_inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate webhook secret
    if (webhookSecret && instance.webhook_secret && webhookSecret !== instance.webhook_secret) {
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Normalize WATI event → Evolution-compatible format and queue ──
    let normalizedEventType: string;
    let normalizedPayload: any;

    if (["message", "message_received", "session_message", "template_message"].includes(watiEventType)) {
      // Inbound message
      const normalized = normalizeInboundMessageWati(body);
      if (!normalized) {
        console.warn(`[wati-webhook] Could not normalize message: ${JSON.stringify(body).substring(0, 200)}`);
        return new Response(JSON.stringify({ error: "Cannot normalize message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      normalizedEventType = "messages.upsert";
      normalizedPayload = { data: [normalized], _wati_raw: body, _provider: "wati" };

    } else if (["message_status", "status", "delivery", "read"].includes(watiEventType)) {
      // Status update
      const normalized = normalizeStatusEventWati(body);
      if (!normalized) {
        console.warn(`[wati-webhook] Could not normalize status: ${JSON.stringify(body).substring(0, 200)}`);
        return new Response(JSON.stringify({ success: true, skipped: "unrecognized_status" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      normalizedEventType = "messages.update";
      normalizedPayload = { data: [normalized], _wati_raw: body, _provider: "wati" };

    } else {
      // Other events (contact updates, etc.)
      normalizedEventType = watiEventType;
      normalizedPayload = { ...body, _provider: "wati" };
    }

    // Queue into the SAME wa_webhook_events table → reuse process-webhook-events
    const { error: insertError } = await supabase
      .from("wa_webhook_events")
      .insert({
        instance_id: instance.id,
        tenant_id: instance.tenant_id,
        event_type: normalizedEventType,
        payload: normalizedPayload,
        processed: false,
      });

    if (insertError) {
      console.error("[wati-webhook] Failed to queue event:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queueMs = Date.now() - t0;
    console.log(`[TIMING] {\"step\":\"wati_webhook_queued\",\"elapsed_ms\":${queueMs},\"event_type\":\"${normalizedEventType}\",\"instance\":\"${instance.id}\",\"wati_event\":\"${watiEventType}\"}`);

    // Auto-trigger processing
    if (["messages.upsert", "messages.update"].includes(normalizedEventType)) {
      try {
        const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-webhook-events`;
        fetch(processUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        }).catch(e => console.warn("[wati-webhook] Auto-process trigger failed:", e));
      } catch (_) {}
    }

    return new Response(JSON.stringify({ success: true, queue_ms: queueMs, provider: "wati" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wati-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
