import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Integration Health Check — runs checks against external APIs and persists results
 * to `integration_health_cache` table.
 *
 * Two invocation modes:
 * 1. Authenticated (admin clicks "Refresh") — checks only their tenant
 * 2. Cron (pg_cron via pg_net) — checks ALL active tenants
 *
 * Status mapping: healthy | degraded | down | not_configured
 */

type HealthStatus = "healthy" | "degraded" | "down" | "not_configured";

interface CheckResult {
  integration_name: string;
  status: HealthStatus;
  latency_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    let tenantIds: string[] = [];
    let isManualRefresh = false;

    if (authHeader?.startsWith("Bearer ")) {
      // Authenticated mode — resolve single tenant
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.claims.sub;

      // Admin check
      const { data: roleData } = await supabaseUser
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "gerente"])
        .limit(1)
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      tenantIds = [profile.tenant_id];
      isManualRefresh = true;
    } else {
      // Cron mode — check all active tenants
      const { data: tenants } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("ativo", true)
        .limit(100); // Safety limit

      tenantIds = (tenants || []).map((t: { id: string }) => t.id);
    }

    if (tenantIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No tenants to check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allResults: Record<string, CheckResult[]> = {};

    for (const tenantId of tenantIds) {
      const results: CheckResult[] = [];

      // ── WhatsApp ──
      results.push(await checkWhatsApp(supabaseAdmin, tenantId));

      // ── OpenAI ──
      results.push(await checkOpenAI(supabaseAdmin, tenantId));

      // ── Google Gemini ──
      results.push(await checkGemini(supabaseAdmin, tenantId));

      // ── SolarMarket ──
      results.push(await checkSolarMarket(supabaseAdmin, tenantId));

      // ── Google Calendar ──
      results.push(await checkGoogleCalendar(supabaseAdmin, tenantId));

      // Persist all results to cache
      const now = new Date().toISOString();
      for (const r of results) {
        await supabaseAdmin.from("integration_health_cache").upsert(
          {
            tenant_id: tenantId,
            integration_name: r.integration_name,
            status: r.status,
            latency_ms: r.latency_ms,
            error_message: r.error_message,
            details: r.details,
            last_check_at: now,
          },
          { onConflict: "tenant_id,integration_name" }
        );
      }

      allResults[tenantId] = results;
    }

    // For manual refresh, return results for immediate UI update
    if (isManualRefresh && tenantIds.length === 1) {
      return new Response(
        JSON.stringify({ success: true, results: allResults[tenantIds[0]] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenants_checked: tenantIds.length,
        message: `Checked ${tenantIds.length} tenant(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in integration-health-check:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Check Functions ───

async function checkWhatsApp(admin: any, tenantId: string): Promise<CheckResult> {
  try {
    const { data: instances } = await admin
      .from("wa_instances")
      .select("id, nome, status, evolution_api_url, evolution_instance_key, api_key, phone_number")
      .eq("tenant_id", tenantId)
      .limit(20);

    if (!instances || instances.length === 0) {
      return { integration_name: "whatsapp", status: "not_configured", latency_ms: null, error_message: null, details: { reason: "Nenhuma instância configurada" } };
    }

    const globalApiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    let onlineCount = 0;
    const latencies: number[] = [];
    const instanceDetails: Record<string, unknown>[] = [];

    for (const inst of instances) {
      const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
      const instanceKey = inst.evolution_instance_key;
      const apiKey = inst.api_key || globalApiKey;

      if (!apiUrl || !instanceKey) {
        instanceDetails.push({ name: inst.nome, ok: false, error: "URL/key missing" });
        continue;
      }

      try {
        const start = Date.now();
        const stateRes = await fetch(
          `${apiUrl}/instance/connectionState/${encodeURIComponent(instanceKey)}`,
          {
            method: "GET",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
          }
        );
        const latency = Date.now() - start;
        latencies.push(latency);

        if (stateRes.ok) {
          const stateJson = await stateRes.json();
          const state = stateJson?.instance?.state || stateJson?.state;
          const ok = state === "open";
          if (ok) onlineCount++;
          instanceDetails.push({ name: inst.nome, ok, state, latency_ms: latency, phone: inst.phone_number });
        } else {
          const errText = await stateRes.text();
          instanceDetails.push({ name: inst.nome, ok: false, error: `HTTP ${stateRes.status}`, latency_ms: latency });
        }
      } catch (err: any) {
        instanceDetails.push({ name: inst.nome, ok: false, error: err.message });
      }
    }

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    let status: HealthStatus = "down";
    if (onlineCount === instances.length) status = "healthy";
    else if (onlineCount > 0) status = "degraded";

    return {
      integration_name: "whatsapp",
      status,
      latency_ms: avgLatency,
      error_message: onlineCount < instances.length ? `${instances.length - onlineCount}/${instances.length} instâncias offline` : null,
      details: { online: onlineCount, total: instances.length, instances: instanceDetails },
    };
  } catch (err: any) {
    return { integration_name: "whatsapp", status: "down", latency_ms: null, error_message: err.message, details: {} };
  }
}

async function checkOpenAI(admin: any, tenantId: string): Promise<CheckResult> {
  try {
    const { data: configRow } = await admin
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .maybeSingle();

    const key = configRow?.api_key || Deno.env.get("OPENAI_API_KEY") || null;
    if (!key) {
      return { integration_name: "openai", status: "not_configured", latency_ms: null, error_message: null, details: {} };
    }

    const start = Date.now();
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;

    if (res.ok) {
      await res.text();
      return { integration_name: "openai", status: "healthy", latency_ms: latency, error_message: null, details: {} };
    }
    const errText = await res.text();
    return {
      integration_name: "openai",
      status: res.status === 401 ? "down" : "degraded",
      latency_ms: latency,
      error_message: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
      details: {},
    };
  } catch (err: any) {
    return { integration_name: "openai", status: "down", latency_ms: null, error_message: err.message, details: {} };
  }
}

async function checkGemini(admin: any, tenantId: string): Promise<CheckResult> {
  try {
    const { data: configRow } = await admin
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", "google_gemini")
      .eq("is_active", true)
      .maybeSingle();

    if (!configRow?.api_key) {
      return { integration_name: "google_gemini", status: "not_configured", latency_ms: null, error_message: null, details: {} };
    }

    const start = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${configRow.api_key}`,
      { method: "GET", signal: AbortSignal.timeout(10000) }
    );
    const latency = Date.now() - start;

    if (res.ok) {
      await res.text();
      return { integration_name: "google_gemini", status: "healthy", latency_ms: latency, error_message: null, details: {} };
    }
    const errText = await res.text();
    return {
      integration_name: "google_gemini",
      status: res.status === 400 || res.status === 403 ? "down" : "degraded",
      latency_ms: latency,
      error_message: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
      details: {},
    };
  } catch (err: any) {
    return { integration_name: "google_gemini", status: "down", latency_ms: null, error_message: err.message, details: {} };
  }
}

async function checkSolarMarket(admin: any, tenantId: string): Promise<CheckResult> {
  try {
    const smToken = Deno.env.get("SOLARMARKET_TOKEN");
    if (!smToken) {
      return { integration_name: "solarmarket", status: "not_configured", latency_ms: null, error_message: null, details: {} };
    }

    const start = Date.now();
    const res = await fetch("https://api.solarmarket.com.br/v2/clientes?page=1&per_page=1", {
      method: "GET",
      headers: { Authorization: `Bearer ${smToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const latency = Date.now() - start;

    if (res.ok) {
      await res.text();
      return { integration_name: "solarmarket", status: "healthy", latency_ms: latency, error_message: null, details: {} };
    }
    const errText = await res.text();
    return {
      integration_name: "solarmarket",
      status: res.status === 401 ? "down" : "degraded",
      latency_ms: latency,
      error_message: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
      details: {},
    };
  } catch (err: any) {
    return { integration_name: "solarmarket", status: "down", latency_ms: null, error_message: err.message, details: {} };
  }
}

async function checkGoogleCalendar(admin: any, tenantId: string): Promise<CheckResult> {
  try {
    const { data: configs } = await admin
      .from("integration_configs")
      .select("service_key")
      .eq("tenant_id", tenantId)
      .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"])
      .eq("is_active", true);

    const hasClientId = configs?.some((c: any) => c.service_key === "google_calendar_client_id");
    const hasSecret = configs?.some((c: any) => c.service_key === "google_calendar_client_secret");

    if (!hasClientId || !hasSecret) {
      return { integration_name: "google_calendar", status: "not_configured", latency_ms: null, error_message: null, details: {} };
    }

    // Check if any user has active tokens
    const { count } = await admin
      .from("google_calendar_tokens")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (!count || count === 0) {
      return {
        integration_name: "google_calendar",
        status: "degraded",
        latency_ms: null,
        error_message: "Credenciais configuradas mas nenhum usuário conectou",
        details: { configured: true, connected_users: 0 },
      };
    }

    return {
      integration_name: "google_calendar",
      status: "healthy",
      latency_ms: null,
      error_message: null,
      details: { configured: true, connected_users: count },
    };
  } catch (err: any) {
    return { integration_name: "google_calendar", status: "down", latency_ms: null, error_message: err.message, details: {} };
  }
}
