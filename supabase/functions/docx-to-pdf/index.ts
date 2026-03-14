/**
 * Edge Function: docx-to-pdf
 * Converts a DOCX file to PDF using Gotenberg (LibreOffice-based).
 * Preserves floating text boxes, drawing anchors, and complex Word layouts.
 *
 * Input (JSON):
 *   - docxBase64: string (base64-encoded DOCX file)
 *   - filename?: string (optional filename, default "proposta.docx")
 *   - tenant_id?: string (optional, to resolve config from DB)
 *
 * Output (JSON):
 *   - pdf: string (base64-encoded PDF)
 *
 * Environment:
 *   - GOTENBERG_URL: Gotenberg service URL (fallback if DB config not found)
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { docxBase64, filename, tenant_id } = await req.json();

    if (!docxBase64 || typeof docxBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "docxBase64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[docx-to-pdf] Converting ${filename || "proposta.docx"}, base64 length: ${docxBase64.length}`);

    // Decode base64 to binary
    const binaryStr = atob(docxBase64);
    const docxBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      docxBytes[i] = binaryStr.charCodeAt(i);
    }
    console.log(`[docx-to-pdf] DOCX size: ${docxBytes.length} bytes`);

    // Build multipart form for Gotenberg
    const formData = new FormData();
    const blob = new Blob([docxBytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("files", blob, filename || "proposta.docx");
    formData.append("landscape", "false");
    formData.append("nativePageRanges", "1-");

    // Resolve Gotenberg URL: DB config → env → demo fallback
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resolvedTenantId = tenant_id;
    if (!resolvedTenantId) {
      // Try to get tenant from auth header
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
        const anonClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await anonClient.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("user_id", user.id)
            .maybeSingle();
          resolvedTenantId = profile?.tenant_id;
        }
      }
    }

    const GOTENBERG_URL = await resolveGotenbergUrl(supabase, resolvedTenantId);
    const conversionUrl = `${GOTENBERG_URL}/forms/libreoffice/convert`;
    console.log(`[docx-to-pdf] Sending to Gotenberg: ${conversionUrl}`);

    const response = await fetch(
      conversionUrl,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(90000), // 90s timeout
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[docx-to-pdf] Gotenberg error ${response.status}: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Gotenberg retornou erro ${response.status}: ${errorText}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);
    console.log(`[docx-to-pdf] PDF generated: ${pdfBytes.length} bytes`);

    // Encode PDF to base64
    let pdfBase64 = "";
    const chunkSize = 32768;
    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
      const chunk = pdfBytes.subarray(i, i + chunkSize);
      pdfBase64 += String.fromCharCode(...chunk);
    }
    pdfBase64 = btoa(pdfBase64);

    return new Response(
      JSON.stringify({ pdf: pdfBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[docx-to-pdf] Error:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno na conversão" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
