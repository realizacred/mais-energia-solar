/**
 * Edge Function: gotenberg-health
 * Tests Gotenberg connectivity via /health endpoint.
 * With circuit breaker: after 3 consecutive failures, marks as "unhealthy" for 5min.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isCircuitOpen,
  recordFailure,
  resetCircuit,
  updateHealthCache,
  type CircuitBreakerState,
} from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory circuit breaker (resets on cold start; persisted via health cache)
let circuitState: CircuitBreakerState = { failures: 0, last_failure_at: null, open_until: null };

function validateUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`URL inválida: "${url}" — deve começar com http:// ou https://`);
  }
  new URL(url);
  return url;
}

async function resolveGotenbergUrl(supabase: any, tenantId?: string): Promise<string> {
  if (tenantId) {
    const { data } = await supabase
      .from("integration_connections")
      .select("config, status")
      .eq("provider_id", "gotenberg")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (data?.config?.base_url) {
      return validateUrl(data.config.base_url);
    }
  }

  const envUrl = Deno.env.get("GOTENBERG_URL");
  if (envUrl && envUrl.trim()) {
    return validateUrl(envUrl);
  }

  throw new Error("Nenhuma URL do Gotenberg configurada. Configure na integração ou defina GOTENBERG_URL.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check circuit breaker
    if (isCircuitOpen(circuitState)) {
      console.warn("[gotenberg-health] Circuit breaker OPEN — skipping check");
      return new Response(JSON.stringify({
        success: false,
        error: "Gotenberg marcado como indisponível (circuit breaker aberto). Tente em 5 minutos.",
        circuit_open: true,
        open_until: circuitState.open_until,
        tested_at: new Date().toISOString(),
      }), { status: 200, headers: jsonHeaders });
    }

    let tenantId: string | undefined;
    if (authHeader) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        tenantId = profile?.tenant_id;
      }
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const baseUrlOverride = body.base_url;

    let baseUrl: string;
    if (baseUrlOverride) {
      baseUrl = validateUrl(baseUrlOverride);
    } else {
      baseUrl = await resolveGotenbergUrl(supabase, tenantId);
    }

    const healthUrl = `${baseUrl}/health`;
    console.log(`[gotenberg-health] Testing: ${healthUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const text = await resp.text();
        // Record failure in circuit breaker
        circuitState = recordFailure(circuitState);
        await updateHealthCache(supabase, "gotenberg", "degraded", {
          error_message: `Status ${resp.status}: ${text}`,
          metadata: { circuit_failures: circuitState.failures },
        }, tenantId);

        return new Response(JSON.stringify({
          success: false,
          error: `Gotenberg retornou status ${resp.status}: ${text}`,
          base_url: baseUrl,
          circuit_failures: circuitState.failures,
          tested_at: new Date().toISOString(),
        }), { status: 200, headers: jsonHeaders });
      }

      const healthData = await resp.json().catch(() => null);

      // Success — reset circuit breaker
      if (circuitState.failures > 0) {
        circuitState = resetCircuit();
      }

      // Update connection status in DB
      if (tenantId && !baseUrlOverride) {
        await supabase
          .from("integration_connections")
          .update({
            status: "connected",
            sync_error: null,
            last_sync_at: new Date().toISOString(),
            config: { ...(body.save_config || {}), last_health: healthData, last_health_at: new Date().toISOString() },
          })
          .eq("provider_id", "gotenberg")
          .eq("tenant_id", tenantId);
      }

      await updateHealthCache(supabase, "gotenberg", "up", {}, tenantId);

      return new Response(JSON.stringify({
        success: true,
        base_url: baseUrl,
        health: healthData,
        tested_at: new Date().toISOString(),
      }), { status: 200, headers: jsonHeaders });

    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const isTimeout = fetchErr.name === "AbortError";

      // Record failure in circuit breaker
      circuitState = recordFailure(circuitState);
      const isOpen = isCircuitOpen(circuitState);

      await updateHealthCache(supabase, "gotenberg", isOpen ? "down" : "degraded", {
        error_message: isTimeout ? "Timeout (15s)" : fetchErr.message,
        metadata: { circuit_failures: circuitState.failures, circuit_open: isOpen },
      }, tenantId);

      return new Response(JSON.stringify({
        success: false,
        error: isTimeout
          ? `Timeout ao conectar em ${baseUrl} (15s). Verifique se o servidor está acessível.`
          : `Erro ao conectar: ${fetchErr.message}`,
        base_url: baseUrl,
        circuit_failures: circuitState.failures,
        circuit_open: isOpen,
        tested_at: new Date().toISOString(),
      }), { status: 200, headers: jsonHeaders });
    }

  } catch (err: any) {
    console.error("[gotenberg-health] Error:", err.message);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      tested_at: new Date().toISOString(),
    }), { status: 200, headers: jsonHeaders });
  }
});
