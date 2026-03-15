/**
 * Edge Function: gotenberg-health
 * Tests Gotenberg connectivity via /health endpoint.
 * Reads config from integration_connections first, falls back to GOTENBERG_URL env.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function validateUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error(`URL inválida: "${url}" — deve começar com http:// ou https://`);
  }
  new URL(url); // validates structure
  return url;
}

/**
 * Resolve Gotenberg base URL from DB config or env fallback.
 */
async function resolveGotenbergUrl(supabase: any, tenantId?: string): Promise<string> {
  // 1. Try DB config from integration_connections
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

  // 2. Fallback to env
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

    // Get tenant from JWT
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
    const baseUrlOverride = body.base_url; // optional: test a specific URL before saving

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
        return new Response(JSON.stringify({
          success: false,
          error: `Gotenberg retornou status ${resp.status}: ${text}`,
          base_url: baseUrl,
          tested_at: new Date().toISOString(),
        }), { status: 200, headers: jsonHeaders });
      }

      const healthData = await resp.json().catch(() => null);

      // Update connection status in DB if tenant exists
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

      return new Response(JSON.stringify({
        success: true,
        base_url: baseUrl,
        health: healthData,
        tested_at: new Date().toISOString(),
      }), { status: 200, headers: jsonHeaders });

    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const isTimeout = fetchErr.name === "AbortError";
      return new Response(JSON.stringify({
        success: false,
        error: isTimeout
          ? `Timeout ao conectar em ${baseUrl} (15s). Verifique se o servidor está acessível.`
          : `Erro ao conectar: ${fetchErr.message}`,
        base_url: baseUrl,
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
