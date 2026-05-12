/**
 * Edge Function: signature-webhook
 * Receives webhook callbacks from signature providers (ZapSign, Clicksign, Autentique).
 * DA-29: Detects provider by payload format.
 *
 * Security:
 *  - HMAC validation against signature_settings.webhook_secret_encrypted
 *  - On signed: fetches signed PDF from provider and archives in Storage
 *
 * RB-23: No console.log — only console.error with prefix
 * Public endpoint — no JWT verification
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  detectWebhookProvider,
  parseZapSignWebhook,
  parseClickSignWebhook,
  parseAutentiqueWebhook,
  parseAssinafyWebhook,
  mapZapSignStatus,
  mapClickSignStatus,
  mapAutentiqueStatus,
  mapAssinafyStatus,
} from "../_shared/signatureAdapters.ts";
import { validateWebhookSignature } from "../_shared/signatureWebhookSecurity.ts";
import { archiveSignedPdf } from "../_shared/signedPdfArchiver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-autentique-signature, x-zapsign-webhook-token, x-clicksign-hmac-sha256, x-assinafy-signature",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ok = () => new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  const unauthorized = () => new Response(JSON.stringify({ error: "invalid signature" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Read raw body once for HMAC validation, then parse
    const rawBody = await req.text();
    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error("[signature-webhook] Invalid JSON payload");
      return ok();
    }

    const provider = detectWebhookProvider(body);
    if (provider === "unknown") {
      console.error("[signature-webhook] Unknown provider format in payload");
      return ok();
    }

    let docToken: string | null = null;
    let mappedStatus: { signatureStatus: string; docStatus: string; isSigned: boolean } | null = null;

    if (provider === "clicksign") {
      const p = parseClickSignWebhook(body);
      docToken = p.docToken;
      mappedStatus = p.status ? mapClickSignStatus(p.status) : null;
    } else if (provider === "autentique") {
      const p = parseAutentiqueWebhook(body);
      docToken = p.docToken;
      mappedStatus = p.status ? mapAutentiqueStatus(p.status) : null;
    } else if (provider === "assinafy") {
      const p = parseAssinafyWebhook(body);
      docToken = p.docToken;
      mappedStatus = p.status ? mapAssinafyStatus(p.status) : null;
    } else {
      const p = parseZapSignWebhook(body);
      docToken = p.docToken;
      mappedStatus = p.status ? mapZapSignStatus(p.status) : null;
    }

    if (!docToken) {
      console.error("[signature-webhook] Missing token in payload");
      return ok();
    }

    // Find the document by envelope_id (need tenant before HMAC validation)
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, tenant_id, signature_status, signature_provider, envelope_id, signed_pdf_path")
      .eq("envelope_id", docToken)
      .single();

    if (docErr || !doc) {
      console.error("[signature-webhook] Document not found for token:", docToken);
      return ok();
    }

    // Load tenant signature settings
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("api_token_encrypted, webhook_secret_encrypted, sandbox_mode")
      .eq("tenant_id", doc.tenant_id)
      .maybeSingle();

    // ── HMAC VALIDATION ──
    const valid = await validateWebhookSignature(
      provider,
      rawBody,
      req.headers,
      settings?.webhook_secret_encrypted ?? null,
    );
    if (!valid) {
      console.error("[signature-webhook] Invalid HMAC signature for tenant:", doc.tenant_id);
      return unauthorized();
    }

    if (!mappedStatus) {
      console.error("[signature-webhook] Unknown status in payload for provider:", provider);
      return ok();
    }

    // Skip if already in a terminal state AND already archived
    if ((doc.signature_status === "signed" && doc.signed_pdf_path) || doc.signature_status === "cancelled") {
      return ok();
    }

    const updatePayload: Record<string, unknown> = {
      signature_status: mappedStatus.signatureStatus,
      status: mappedStatus.docStatus,
      updated_at: new Date().toISOString(),
    };
    if (mappedStatus.isSigned) {
      updatePayload.signed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from("generated_documents")
      .update(updatePayload)
      .eq("id", doc.id)
      .eq("tenant_id", doc.tenant_id);
    if (updateErr) {
      console.error("[signature-webhook] DB update error:", updateErr);
    }

    // ── ARCHIVE SIGNED PDF ──
    if (mappedStatus.isSigned && !doc.signed_pdf_path && settings?.api_token_encrypted) {
      const result = await archiveSignedPdf({
        supabase,
        doc: {
          id: doc.id,
          tenant_id: doc.tenant_id,
          envelope_id: doc.envelope_id,
          signature_provider: doc.signature_provider || provider,
        },
        apiToken: settings.api_token_encrypted,
        sandbox: !!settings.sandbox_mode,
      });
      if (!result.ok) {
        console.error("[signature-webhook] Archive deferred to cron:", result.reason);
        // pg_cron `signature-archive-pending-5m` will retry
      }
    }

    return ok();
  } catch (err: any) {
    console.error("[signature-webhook] Unexpected error:", err?.message);
    return ok();
  }
});
