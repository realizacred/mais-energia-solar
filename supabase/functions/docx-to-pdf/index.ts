/**
 * Edge Function: docx-to-pdf
 * Converts a DOCX file to PDF using Gotenberg (LibreOffice-based).
 * With retry (exponential backoff) and circuit breaker.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizeDocxVariableFormat } from "../_shared/normalizeVariableFormat.ts";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";
import {
  withRetry,
  fetchWithTimeout,
  isCircuitOpen,
  recordFailure,
  resetCircuit,
  sanitizeError,
  updateHealthCache,
  type CircuitBreakerState,
} from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory circuit breaker state (resets per cold start; persisted via health cache)
let circuitState: CircuitBreakerState = { failures: 0, last_failure_at: null, open_until: null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { docxBase64, filename, tenant_id } = await req.json();

    if (!docxBase64 || typeof docxBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "docxBase64 é obrigatório" }),
        { status: 400, headers: jsonHeaders },
      );
    }

    // Check circuit breaker
    if (isCircuitOpen(circuitState)) {
      console.warn("[docx-to-pdf] Circuit breaker OPEN — Gotenberg marked as down");
      return new Response(
        JSON.stringify({
          error: "Serviço de conversão temporariamente indisponível. Tente novamente em 5 minutos.",
          circuit_open: true,
          retry_after_seconds: 300,
        }),
        { status: 503, headers: jsonHeaders },
      );
    }

    // Decode base64 to binary
    const binaryStr = atob(docxBase64);
    const docxBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      docxBytes[i] = binaryStr.charCodeAt(i);
    }
    const normalizedDocxBytes = normalizeDocxVariableFormat(docxBytes);

    // Build multipart form for Gotenberg
    const formData = new FormData();
    const normalizedArrayBuffer = normalizedDocxBytes.buffer.slice(
      normalizedDocxBytes.byteOffset,
      normalizedDocxBytes.byteOffset + normalizedDocxBytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([normalizedArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("files", blob, filename || "proposta.docx");
    formData.append("landscape", "false");
    formData.append("nativePageRanges", "1-");
    formData.append("losslessImageCompression", "false");
    formData.append("reduceImageResolution", "true");
    formData.append("quality", "90");
    formData.append("maxImageResolution", "150");
    formData.append("exportFormFields", "false");
    formData.append("skipEmptyPages", "true");

    // Resolve Gotenberg URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let resolvedTenantId = tenant_id;
    if (!resolvedTenantId) {
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
    // Retry with exponential backoff: 1s, 2s, 4s
    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(
          conversionUrl,
          { method: "POST", body: formData },
          90000, // 90s timeout per attempt
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gotenberg ${res.status}: ${errorText}`);
        }
        return res;
      },
      {
        maxRetries: 2, // 3 total attempts
        baseDelayMs: 1000,
        onRetry: (attempt, err) => {
          console.warn(`[docx-to-pdf] Retry ${attempt}/2: ${sanitizeError(err)}`);
        },
      },
    ).catch((err) => {
      // All retries failed — record circuit breaker failure
      circuitState = recordFailure(circuitState);
      console.error(`[docx-to-pdf] All retries failed. Circuit state: failures=${circuitState.failures}, open_until=${circuitState.open_until}`);

      // Update health cache
      updateHealthCache(supabase, "gotenberg", "down", {
        error_message: sanitizeError(err),
        metadata: { circuit_state: circuitState },
      }, resolvedTenantId);

      throw err;
    });

    // Success — reset circuit breaker
    if (circuitState.failures > 0) {
      circuitState = resetCircuit();
      updateHealthCache(supabase, "gotenberg", "up", {}, resolvedTenantId);
    }

    const pdfBuffer = await response.arrayBuffer();
    const pdfBytes = new Uint8Array(pdfBuffer);

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
      { headers: jsonHeaders },
    );
  } catch (err: any) {
    console.error("[docx-to-pdf] Error:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: sanitizeError(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
