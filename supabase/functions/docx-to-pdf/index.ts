/**
 * Edge Function: docx-to-pdf
 * Converts a DOCX file to PDF using Gotenberg (LibreOffice-based).
 * Preserves floating text boxes, drawing anchors, and complex Word layouts.
 *
 * Input (JSON):
 *   - docxBase64: string (base64-encoded DOCX file)
 *   - filename?: string (optional filename, default "proposta.docx")
 *
 * Output (JSON):
 *   - pdf: string (base64-encoded PDF)
 *
 * Environment:
 *   - GOTENBERG_URL: Gotenberg service URL (default: https://demo.gotenberg.dev)
 */

/**
 * Validates and normalizes a base URL for external services.
 */
function validateAndNormalizeBaseUrl(
  rawUrl: string | undefined,
  envVarName: string,
  defaultUrl = "https://demo.gotenberg.dev",
): string {
  const urlStr = (rawUrl && rawUrl.trim()) ? rawUrl.trim() : defaultUrl;

  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    throw new Error(
      `Configuração inválida: ${envVarName} ("${urlStr}") não possui protocolo válido (http/https). ` +
      `Verifique a variável de ambiente ${envVarName} nas configurações do projeto.`
    );
  }

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Protocolo "${parsed.protocol}" não suportado.`);
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch (e: any) {
    throw new Error(
      `Configuração inválida: ${envVarName} ("${urlStr}") não é uma URL válida. ` +
      `Erro: ${e.message}. Verifique a variável de ambiente ${envVarName}.`
    );
  }
}

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
    const { docxBase64, filename } = await req.json();

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

    // Validate and normalize URL before using
    const rawGotenbergUrl = Deno.env.get("GOTENBERG_URL");
    const GOTENBERG_URL = validateAndNormalizeBaseUrl(rawGotenbergUrl, "GOTENBERG_URL");
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
