/**
 * Edge Function: signature-webhook
 * Receives ZapSign webhook callbacks for signature status updates.
 * 
 * RB-23: No console.log — only console.error with prefix
 * Public endpoint — no JWT verification
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Always return 200 to ZapSign to prevent retries
  const ok = () => new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();

    // ZapSign sends: { event, doc: { token, status, ... }, signer: { ... } }
    // Or legacy format: { token, status, signers: [...] }
    const docToken = body?.doc?.token || body?.token;
    const eventStatus = body?.doc?.status || body?.status;

    if (!docToken) {
      console.error("[signature-webhook] Missing token in payload");
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

    // Map ZapSign status to our status
    let newSignatureStatus: string;
    let newDocStatus: string;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    switch (eventStatus) {
      case "signed":
      case "completed":
        newSignatureStatus = "signed";
        newDocStatus = "signed";
        updatePayload.signed_at = new Date().toISOString();
        break;
      case "refused":
      case "rejected":
        newSignatureStatus = "refused";
        newDocStatus = "cancelled";
        break;
      case "link_opened":
      case "opened":
        // Signer opened the document — keep as sent
        newSignatureStatus = "viewed";
        newDocStatus = "sent_for_signature";
        break;
      case "cancelled":
        newSignatureStatus = "cancelled";
        newDocStatus = "cancelled";
        break;
      default:
        // Unknown status — log and skip
        console.error("[signature-webhook] Unknown status:", eventStatus, "for token:", docToken);
        return ok();
    }

    updatePayload.signature_status = newSignatureStatus;
    updatePayload.status = newDocStatus;

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
    // Always return 200 to prevent ZapSign retries
    return ok();
  }
});
