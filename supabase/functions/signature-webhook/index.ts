/**
 * Edge Function: signature-webhook
 * Receives webhook callbacks from signature providers (ZapSign, Clicksign, Autentique).
 * DA-29: Detects provider by payload format.
 * 
 * RB-23: No console.log — only console.error with prefix
 * Public endpoint — no JWT verification
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";
import {
  detectWebhookProvider,
  parseZapSignWebhook,
  parseClickSignWebhook,
  parseAutentiqueWebhook,
  mapZapSignStatus,
  mapClickSignStatus,
  mapAutentiqueStatus,
} from "../_shared/signatureAdapters.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Always return 200 to prevent provider retries
  const ok = () => new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // DA-29: Detect provider by payload format
    const provider = detectWebhookProvider(body);

    let docToken: string | null;
    let mappedStatus: { signatureStatus: string; docStatus: string; isSigned: boolean } | null;

    if (provider === "clicksign") {
      const parsed = parseClickSignWebhook(body);
      docToken = parsed.docToken;
      mappedStatus = parsed.status ? mapClickSignStatus(parsed.status) : null;
    } else if (provider === "autentique") {
      const parsed = parseAutentiqueWebhook(body);
      docToken = parsed.docToken;
      mappedStatus = parsed.status ? mapAutentiqueStatus(parsed.status) : null;
    } else if (provider === "zapsign") {
      const parsed = parseZapSignWebhook(body);
      docToken = parsed.docToken;
      mappedStatus = parsed.status ? mapZapSignStatus(parsed.status) : null;
    } else {
      console.error("[signature-webhook] Unknown provider format in payload");
      return ok();
    }

    if (!docToken) {
      console.error("[signature-webhook] Missing token in payload");
      return ok();
    }

    if (!mappedStatus) {
      console.error("[signature-webhook] Unknown status in payload for provider:", provider);
      return ok();
    }

    // Find the document by envelope_id
    const { data: doc, error: docErr } = await supabase
      .from("generated_documents")
      .select("id, tenant_id, signature_status")
      .eq("envelope_id", docToken)
      .single();

    if (docErr || !doc) {
      console.error("[signature-webhook] Document not found for token:", docToken);
      return ok();
    }

    // Skip if already in a terminal state
    if (doc.signature_status === "signed" || doc.signature_status === "cancelled") {
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

    return ok();

  } catch (err: any) {
    console.error("[signature-webhook] Unexpected error:", err.message);
    return ok();
  }
});
