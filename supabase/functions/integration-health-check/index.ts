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

interface InstanceHealth {
  instance_id: string;
  instance_name: string;
  phone_number: string | null;
  profile_name: string | null;
  ok: boolean;
  evolution_state: string | null;
  latency_ms: number | null;
  error_message: string | null;
  last_seen_at: string | null;
  last_webhook_at: string | null;
  last_send_ok_at: string | null;
  outbox_pending_count: number;
  vendedores: { id: string; nome: string; codigo: string }[];
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
    const integration = body.integration || "all";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve tenant
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();
    const tenantId = profileData?.tenant_id;

    const results: IntegrationResult[] = [];
    const now = new Date().toISOString();
    let instanceHealthList: InstanceHealth[] = [];

    // ── WhatsApp (Evolution API) — per-instance health ──
    if (integration === "all" || integration === "whatsapp") {
      try {
        const { data: instances } = await supabaseAdmin
          .from("wa_instances")
          .select("id, nome, status, evolution_api_url, evolution_instance_key, api_key, last_seen_at, phone_number, profile_name, updated_at")
          .eq("tenant_id", tenantId)
          .limit(20);

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
          const totalCount = instances.length;
          const latencies: number[] = [];

          for (const inst of instances) {
            const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
            const instanceKey = inst.evolution_instance_key;
            const apiKey = inst.api_key || globalApiKey;

            const health: InstanceHealth = {
              instance_id: inst.id,
              instance_name: inst.nome,
              phone_number: inst.phone_number,
              profile_name: inst.profile_name,
              ok: false,
              evolution_state: null,
              latency_ms: null,
              error_message: null,
              last_seen_at: inst.last_seen_at,
              last_webhook_at: null,
              last_send_ok_at: null,
              outbox_pending_count: 0,
              vendedores: [],
            };

            // Fetch vendedores linked to this instance
            const { data: vendedorLinks } = await supabaseAdmin
              .from("wa_instance_vendedores")
              .select("vendedor_id")
              .eq("instance_id", inst.id);

            if (vendedorLinks && vendedorLinks.length > 0) {
              const vIds = vendedorLinks.map((vl: { vendedor_id: string }) => vl.vendedor_id);
              const { data: vendedores } = await supabaseAdmin
                .from("vendedores")
                .select("id, nome, codigo")
                .in("id", vIds);
              health.vendedores = (vendedores || []) as { id: string; nome: string; codigo: string }[];
            }

            // Fetch last webhook event for this instance
            const { data: lastWebhook } = await supabaseAdmin
              .from("wa_webhook_events")
              .select("created_at")
              .eq("instance_id", inst.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            health.last_webhook_at = lastWebhook?.created_at || null;

            // Fetch last successful send
            const { data: lastSend } = await supabaseAdmin
              .from("wa_messages")
              .select("created_at")
              .eq("instance_id", inst.id)
              .eq("direction", "out")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            health.last_send_ok_at = lastSend?.created_at || null;

            // Outbox pending count
            const { count: pendingCount } = await supabaseAdmin
              .from("wa_outbox")
              .select("*", { count: "exact", head: true })
              .eq("instance_id", inst.id)
              .eq("status", "pending");
            health.outbox_pending_count = pendingCount || 0;

            // Check Evolution API connectivity
            if (!apiUrl || !instanceKey) {
              health.error_message = "URL ou chave da instância não configurada";
            } else {
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
                health.latency_ms = latency;
                latencies.push(latency);

                if (stateRes.ok) {
                  const stateJson = await stateRes.json();
                  const state = stateJson?.instance?.state || stateJson?.state;
                  health.evolution_state = state || "unknown";
                  if (state === "open") {
                    health.ok = true;
                    onlineCount++;
                  }
                } else {
                  const errText = await stateRes.text();
                  health.error_message = `HTTP ${stateRes.status}: ${errText.slice(0, 150)}`;
                }
              } catch (err: any) {
                health.error_message = err.message || "Timeout ao conectar com Evolution API";
              }
            }

            instanceHealthList.push(health);

            // Persist health check
            if (tenantId) {
              await supabaseAdmin.from("wa_health_checks").insert({
                tenant_id: tenantId,
                instance_id: inst.id,
                ok: health.ok,
                latency_ms: health.latency_ms,
                evolution_state: health.evolution_state,
                error_message: health.error_message,
                checked_at: now,
              });
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

          const { data: lastJob } = await supabaseAdmin
            .from("solar_market_sync_logs")
            .select("status, finished_at, error, created_at")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (smRes.ok) {
            await smRes.text();
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
        let openaiKey: string | null = null;
        if (tenantId) {
          const { data: configRow } = await supabaseAdmin
            .from("integration_configs")
            .select("api_key")
            .eq("tenant_id", tenantId)
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
      JSON.stringify({ success: true, results, instance_health: instanceHealthList }),
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
