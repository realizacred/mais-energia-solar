import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface IntegrationResult {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "not_configured";
  latency_ms?: number;
  details?: string;
  last_event?: string;
  checked_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Admin only
    const { data: roleData } = await supabase
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

    const body = await req.json().catch(() => ({}));
    const integration = body.integration || "all"; // "whatsapp" | "solarmarket" | "openai" | "all"

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: IntegrationResult[] = [];
    const now = new Date().toISOString();

    // ── WhatsApp (Evolution API) ──
    if (integration === "all" || integration === "whatsapp") {
      try {
        const { data: instances } = await supabaseAdmin
          .from("wa_instances")
          .select("id, nome, status, evolution_api_url, evolution_instance_key, api_key, last_seen_at, updated_at")
          .limit(10);

        if (!instances || instances.length === 0) {
          results.push({
            id: "whatsapp",
            name: "WhatsApp (Evolution API)",
            status: "not_configured",
            details: "Nenhuma instância configurada",
            checked_at: now,
          });
        } else {
          const globalApiKey = Deno.env.get("EVOLUTION_API_KEY") || "";
          let onlineCount = 0;
          let totalCount = instances.length;
          let latencies: number[] = [];

          for (const inst of instances) {
            const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
            const instanceKey = inst.evolution_instance_key;
            const apiKey = inst.api_key || globalApiKey;

            if (!apiUrl || !instanceKey) continue;

            try {
              const start = Date.now();
              const encodedKey = encodeURIComponent(instanceKey);
              const stateRes = await fetch(
                `${apiUrl}/instance/connectionState/${encodedKey}`,
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
                if (state === "open") onlineCount++;
              } else {
                await stateRes.text(); // consume body
              }
            } catch {
              // Instance unreachable
            }
          }

          const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : undefined;

          let status: IntegrationResult["status"] = "offline";
          if (onlineCount === totalCount) status = "online";
          else if (onlineCount > 0) status = "degraded";

          results.push({
            id: "whatsapp",
            name: "WhatsApp (Evolution API)",
            status,
            latency_ms: avgLatency,
            details: `${onlineCount}/${totalCount} instâncias conectadas`,
            last_event: instances[0]?.updated_at || undefined,
            checked_at: now,
          });
        }
      } catch (err: any) {
        results.push({
          id: "whatsapp",
          name: "WhatsApp (Evolution API)",
          status: "offline",
          details: err.message || "Erro ao verificar",
          checked_at: now,
        });
      }
    }

    // ── SolarMarket ──
    if (integration === "all" || integration === "solarmarket") {
      try {
        const smToken = Deno.env.get("SOLARMARKET_TOKEN");
        if (!smToken) {
          results.push({
            id: "solarmarket",
            name: "SolarMarket",
            status: "not_configured",
            details: "Token não configurado",
            checked_at: now,
          });
        } else {
          const start = Date.now();
          const smRes = await fetch("https://api.solarmarket.com.br/v2/clientes?page=1&per_page=1", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${smToken}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(10000),
          });
          const latency = Date.now() - start;

          // Get last sync job
          const { data: lastJob } = await supabaseAdmin
            .from("solar_market_sync_jobs")
            .select("status, finished_at, error_message, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (smRes.ok) {
            await smRes.text(); // consume body
            results.push({
              id: "solarmarket",
              name: "SolarMarket",
              status: "online",
              latency_ms: latency,
              details: lastJob ? `Última sync: ${lastJob.status}` : "API acessível",
              last_event: lastJob?.finished_at || lastJob?.created_at || undefined,
              checked_at: now,
            });
          } else {
            const errText = await smRes.text();
            results.push({
              id: "solarmarket",
              name: "SolarMarket",
              status: smRes.status === 401 ? "offline" : "degraded",
              latency_ms: latency,
              details: `HTTP ${smRes.status}: ${errText.slice(0, 100)}`,
              last_event: lastJob?.finished_at || undefined,
              checked_at: now,
            });
          }
        }
      } catch (err: any) {
        results.push({
          id: "solarmarket",
          name: "SolarMarket",
          status: "offline",
          details: err.message || "Timeout ou erro de conexão",
          checked_at: now,
        });
      }
    }

    // ── OpenAI ──
    if (integration === "all" || integration === "openai") {
      try {
        // Try DB first (tenant-specific), fallback to env var
        const { data: tenantProfile } = await supabaseAdmin
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", userId)
          .single();

        let openaiKey: string | null = null;
        if (tenantProfile?.tenant_id) {
          const { data: configRow } = await supabaseAdmin
            .from("integration_configs")
            .select("api_key")
            .eq("tenant_id", tenantProfile.tenant_id)
            .eq("service_key", "openai")
            .eq("is_active", true)
            .maybeSingle();
          openaiKey = configRow?.api_key || null;
        }
        if (!openaiKey) {
          openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
        }

        if (!openaiKey) {
          results.push({
            id: "openai",
            name: "OpenAI",
            status: "not_configured",
            details: "API key não configurada",
            checked_at: now,
          });
        } else {
          const start = Date.now();
          const oaiRes = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: { Authorization: `Bearer ${openaiKey}` },
            signal: AbortSignal.timeout(10000),
          });
          const latency = Date.now() - start;

          if (oaiRes.ok) {
            await oaiRes.text();
            results.push({
              id: "openai",
              name: "OpenAI",
              status: "online",
              latency_ms: latency,
              details: "API acessível",
              checked_at: now,
            });
          } else {
            const errText = await oaiRes.text();
            results.push({
              id: "openai",
              name: "OpenAI",
              status: oaiRes.status === 401 ? "offline" : "degraded",
              latency_ms: latency,
              details: `HTTP ${oaiRes.status}: ${errText.slice(0, 100)}`,
              checked_at: now,
            });
          }
        }
      } catch (err: any) {
        results.push({
          id: "openai",
          name: "OpenAI",
          status: "offline",
          details: err.message || "Timeout ou erro de conexão",
          checked_at: now,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
