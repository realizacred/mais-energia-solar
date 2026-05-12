/**
 * HMAC validation helpers for signature webhooks.
 * RB-23: console.error only.
 */

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type WebhookProviderId = "autentique" | "zapsign" | "clicksign" | "assinafy";

/**
 * Validate webhook signature against the raw body using the tenant secret.
 * Returns true when valid OR when no secret is configured (legacy mode).
 * Returns false only when a secret exists and does not match.
 */
export async function validateWebhookSignature(
  provider: WebhookProviderId,
  rawBody: string,
  headers: Headers,
  secret: string | null | undefined,
): Promise<boolean> {
  if (!secret || !secret.trim()) {
    // No secret configured for this tenant — allow (backwards compatibility).
    return true;
  }

  if (provider === "zapsign") {
    // ZapSign sends a static token in X-ZapSign-Webhook-Token
    const token = headers.get("x-zapsign-webhook-token") || headers.get("x-zapsign-token");
    if (!token) return false;
    return timingSafeEqual(token.trim(), secret.trim());
  }

  if (provider === "autentique") {
    const sig = (
      headers.get("x-autentique-signature") ||
      headers.get("x-authenticity-signature") ||
      ""
    ).trim().replace(/^sha256=/i, "");
    if (!sig) return false;
    const expected = await hmacSha256Hex(secret, rawBody);
    return timingSafeEqual(sig.toLowerCase(), expected.toLowerCase());
  }

  if (provider === "clicksign") {
    const sig = (
      headers.get("x-clicksign-hmac-sha256") ||
      headers.get("content-hmac") ||
      ""
    ).trim().replace(/^sha256=/i, "");
    if (!sig) return false;
    const expected = await hmacSha256Hex(secret, rawBody);
    return timingSafeEqual(sig.toLowerCase(), expected.toLowerCase());
  }

  if (provider === "assinafy") {
    // Assinafy signs the raw body with HMAC-SHA256 in X-Assinafy-Signature.
    const sig = (headers.get("x-assinafy-signature") || "")
      .trim()
      .replace(/^sha256=/i, "");
    if (!sig) return false;
    const expected = await hmacSha256Hex(secret, rawBody);
    return timingSafeEqual(sig.toLowerCase(), expected.toLowerCase());
  }

  return false;
}
