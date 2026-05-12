/**
 * Edge Function: signature-archive-pending
 * Triggered by pg_cron every 5 minutes.
 * Looks for documents with signature_status='signed' AND signed_pdf_path IS NULL,
 * fetches the signed PDF from the provider and archives it in Storage.
 *
 * RB-23: console.error only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { archiveSignedPdf } from "../_shared/signedPdfArchiver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pending, error } = await supabase
    .from("generated_documents")
    .select("id, tenant_id, envelope_id, signature_provider")
    .eq("signature_status", "signed")
    .is("signed_pdf_path", null)
    .not("envelope_id", "is", null)
    .limit(25);

  if (error) {
    console.error("[signature-archive-pending] query error:", error.message);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let archived = 0;
  let skipped = 0;

  for (const doc of pending ?? []) {
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("api_token_encrypted, sandbox_mode")
      .eq("tenant_id", doc.tenant_id)
      .maybeSingle();

    if (!settings?.api_token_encrypted) {
      skipped++;
      continue;
    }

    const result = await archiveSignedPdf({
      supabase,
      doc,
      apiToken: settings.api_token_encrypted,
      sandbox: !!settings.sandbox_mode,
    });
    if (result.ok) archived++; else skipped++;
  }

  return new Response(JSON.stringify({ ok: true, processed: pending?.length ?? 0, archived, skipped }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
