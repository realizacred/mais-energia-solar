/**
 * WhatsApp Provider Adapter — Evolution Classic (Baileys) vs Evolution GO (whatsmeow)
 *
 * Centraliza diferenças de path/payload entre as duas APIs para que as edge functions
 * existentes não precisem saber qual é qual. Cada operação retorna { url, init } prontos
 * para fetch().
 *
 * SRP: este arquivo só monta requisições. Não decide negócio nem persiste nada.
 */

export type WaApiFlavor = "classic" | "go";

export interface WaInstanceContext {
  flavor: WaApiFlavor;
  baseUrl: string;          // já sem trailing slash
  instanceKey: string;      // evolution_instance_key
  apiKey: string;           // header apikey
}

function ctx(input: {
  flavor?: string | null;
  baseUrl: string;
  instanceKey: string;
  apiKey: string;
}): WaInstanceContext {
  return {
    flavor: (input.flavor === "go" ? "go" : "classic"),
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    instanceKey: input.instanceKey,
    apiKey: input.apiKey,
  };
}

function jsonHeaders(c: WaInstanceContext): HeadersInit {
  return { "Content-Type": "application/json", apikey: c.apiKey };
}

/** Headers padrão para chamadas que retornam JSON */
function getHeaders(c: WaInstanceContext): HeadersInit {
  return { apikey: c.apiKey };
}

// ─── Build instance context from a wa_instances row ───────────────────────
export function buildContext(row: {
  api_flavor?: string | null;
  evolution_api_url: string;
  evolution_instance_key: string;
  api_key?: string | null;
}, fallbackApiKey?: string): WaInstanceContext {
  return ctx({
    flavor: row.api_flavor,
    baseUrl: row.evolution_api_url,
    instanceKey: row.evolution_instance_key,
    apiKey: row.api_key || fallbackApiKey || "",
  });
}

// ═════════════════════════════════════════════════════════════════════════
// INSTANCE LIFECYCLE
// ═════════════════════════════════════════════════════════════════════════

/** Create a new instance on the provider */
export function createInstanceRequest(c: WaInstanceContext, opts: {
  number?: string;
  groupsIgnore?: boolean;
  rejectCall?: boolean;
  alwaysOnline?: boolean;
}): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    // Evolution GO: POST /instance/create  body: { instanceId, ... }
    const body: Record<string, unknown> = { instanceId: c.instanceKey };
    if (opts.number) body.number = String(opts.number);
    return {
      url: `${c.baseUrl}/instance/create`,
      init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
    };
  }
  // Classic: POST /instance/create body: { instanceName, integration, qrcode, ... }
  const body: Record<string, unknown> = {
    instanceName: c.instanceKey,
    qrcode: true,
    integration: "WHATSAPP-BAILEYS",
  };
  if (opts.number) body.number = String(opts.number);
  if (opts.groupsIgnore !== undefined) body.groupsIgnore = opts.groupsIgnore;
  if (opts.rejectCall !== undefined) body.rejectCall = opts.rejectCall;
  if (opts.alwaysOnline !== undefined) body.alwaysOnline = opts.alwaysOnline;
  return {
    url: `${c.baseUrl}/instance/create`,
    init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
  };
}

/** Fetch QR code (returns base64 string or null) */
export async function fetchQrCode(c: WaInstanceContext): Promise<string | null> {
  if (c.flavor === "go") {
    // Evolution GO: GET /instance/qr  (instance via header or query)
    const url = `${c.baseUrl}/instance/qr?instanceId=${encodeURIComponent(c.instanceKey)}`;
    const res = await fetch(url, { method: "GET", headers: getHeaders(c) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.qrcode || data?.base64 || data?.qr || null;
  }
  // Classic: GET /instance/connect/{instance}
  const url = `${c.baseUrl}/instance/connect/${encodeURIComponent(c.instanceKey)}`;
  const res = await fetch(url, { method: "GET", headers: getHeaders(c) });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.base64 || data?.qrcode?.base64 || null;
}

/** Get connection state — normalized to: 'open' | 'connecting' | 'close' | 'unknown' */
export async function fetchConnectionState(c: WaInstanceContext): Promise<{
  state: "open" | "connecting" | "close" | "unknown";
  raw: unknown;
}> {
  let url: string;
  if (c.flavor === "go") {
    url = `${c.baseUrl}/instance/status?instanceId=${encodeURIComponent(c.instanceKey)}`;
  } else {
    url = `${c.baseUrl}/instance/connectionState/${encodeURIComponent(c.instanceKey)}`;
  }
  const res = await fetch(url, { method: "GET", headers: getHeaders(c) });
  if (!res.ok) return { state: "unknown", raw: null };
  const data = await res.json().catch(() => null);
  const raw = data?.instance?.state || data?.state || data?.status || "unknown";
  const normalized = String(raw).toLowerCase();
  if (["open", "connected", "online"].includes(normalized)) return { state: "open", raw: data };
  if (["connecting", "qr", "pairing"].includes(normalized)) return { state: "connecting", raw: data };
  if (["close", "closed", "disconnected", "offline"].includes(normalized)) return { state: "close", raw: data };
  return { state: "unknown", raw: data };
}

/** Logout (disconnect session, keep instance config) */
export function logoutRequest(c: WaInstanceContext): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    return {
      url: `${c.baseUrl}/instance/logout`,
      init: {
        method: "DELETE",
        headers: jsonHeaders(c),
        body: JSON.stringify({ instanceId: c.instanceKey }),
      },
    };
  }
  return {
    url: `${c.baseUrl}/instance/logout/${encodeURIComponent(c.instanceKey)}`,
    init: { method: "DELETE", headers: getHeaders(c) },
  };
}

/** Delete the instance permanently on the provider */
export function deleteInstanceRequest(c: WaInstanceContext): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    return {
      url: `${c.baseUrl}/instance/delete/${encodeURIComponent(c.instanceKey)}`,
      init: { method: "DELETE", headers: getHeaders(c) },
    };
  }
  return {
    url: `${c.baseUrl}/instance/delete/${encodeURIComponent(c.instanceKey)}`,
    init: { method: "DELETE", headers: getHeaders(c) },
  };
}

// ═════════════════════════════════════════════════════════════════════════
// WEBHOOK CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════

/** Configure webhook URL on the provider */
export function setWebhookRequest(c: WaInstanceContext, webhookUrl: string, events: string[]): {
  url: string; init: RequestInit
} {
  if (c.flavor === "go") {
    // Evolution GO uses advanced-settings (PUT /instance/{id}/advanced-settings)
    return {
      url: `${c.baseUrl}/instance/${encodeURIComponent(c.instanceKey)}/advanced-settings`,
      init: {
        method: "PUT",
        headers: jsonHeaders(c),
        body: JSON.stringify({
          webhook: { url: webhookUrl, events },
        }),
      },
    };
  }
  return {
    url: `${c.baseUrl}/webhook/set/${encodeURIComponent(c.instanceKey)}`,
    init: {
      method: "POST",
      headers: jsonHeaders(c),
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: false,
        webhook_base64: false,
        events,
      }),
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═════════════════════════════════════════════════════════════════════════

/** Send a text message */
export function sendTextRequest(c: WaInstanceContext, opts: {
  number: string;
  text: string;
  delay?: number;
  quoted?: { id: string; remoteJid?: string };
}): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    // Evolution GO: POST /send/text
    const body: Record<string, unknown> = {
      instanceId: c.instanceKey,
      phone: opts.number,
      message: opts.text,
    };
    if (opts.quoted) body.quoted = opts.quoted;
    return {
      url: `${c.baseUrl}/send/text`,
      init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
    };
  }
  // Classic: POST /message/sendText/{instance}
  const body: Record<string, unknown> = {
    number: opts.number,
    text: opts.text,
  };
  if (opts.delay) body.delay = opts.delay;
  if (opts.quoted) body.quoted = { key: { id: opts.quoted.id, remoteJid: opts.quoted.remoteJid } };
  return {
    url: `${c.baseUrl}/message/sendText/${encodeURIComponent(c.instanceKey)}`,
    init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
  };
}

/** Send media (image, video, document, audio) */
export function sendMediaRequest(c: WaInstanceContext, opts: {
  number: string;
  mediaType: "image" | "video" | "document" | "audio";
  media: string; // URL or base64
  caption?: string;
  fileName?: string;
  mimeType?: string;
}): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    const body: Record<string, unknown> = {
      instanceId: c.instanceKey,
      phone: opts.number,
      mediaType: opts.mediaType,
      media: opts.media,
    };
    if (opts.caption) body.caption = opts.caption;
    if (opts.fileName) body.fileName = opts.fileName;
    if (opts.mimeType) body.mimeType = opts.mimeType;
    return {
      url: `${c.baseUrl}/send/media`,
      init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
    };
  }
  // Classic: POST /message/sendMedia/{instance}
  const body: Record<string, unknown> = {
    number: opts.number,
    mediatype: opts.mediaType,
    media: opts.media,
  };
  if (opts.caption) body.caption = opts.caption;
  if (opts.fileName) body.fileName = opts.fileName;
  if (opts.mimeType) body.mimetype = opts.mimeType;
  return {
    url: `${c.baseUrl}/message/sendMedia/${encodeURIComponent(c.instanceKey)}`,
    init: { method: "POST", headers: jsonHeaders(c), body: JSON.stringify(body) },
  };
}

/** Send presence indicator (composing / paused / available) */
export function sendPresenceRequest(c: WaInstanceContext, opts: {
  number: string;
  presence: "composing" | "paused" | "available";
  delay?: number;
}): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    return {
      url: `${c.baseUrl}/message/presence`,
      init: {
        method: "POST",
        headers: jsonHeaders(c),
        body: JSON.stringify({
          instanceId: c.instanceKey,
          phone: opts.number,
          presence: opts.presence,
        }),
      },
    };
  }
  return {
    url: `${c.baseUrl}/chat/sendPresence/${encodeURIComponent(c.instanceKey)}`,
    init: {
      method: "POST",
      headers: jsonHeaders(c),
      body: JSON.stringify({
        number: opts.number,
        options: { presence: opts.presence, delay: opts.delay ?? 2000 },
      }),
    },
  };
}

/** Mark message as read */
export function markReadRequest(c: WaInstanceContext, opts: {
  remoteJid: string;
  messageId: string;
  fromMe?: boolean;
}): { url: string; init: RequestInit } {
  if (c.flavor === "go") {
    return {
      url: `${c.baseUrl}/message/markread`,
      init: {
        method: "POST",
        headers: jsonHeaders(c),
        body: JSON.stringify({
          instanceId: c.instanceKey,
          phone: opts.remoteJid,
          messageId: opts.messageId,
        }),
      },
    };
  }
  return {
    url: `${c.baseUrl}/chat/markMessageAsRead/${encodeURIComponent(c.instanceKey)}`,
    init: {
      method: "POST",
      headers: jsonHeaders(c),
      body: JSON.stringify({
        readMessages: [{ remoteJid: opts.remoteJid, fromMe: opts.fromMe ?? false, id: opts.messageId }],
      }),
    },
  };
}
