import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Solarman API helpers ───────────────────────────────────

async function solarmanFetch(
  endpoint: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  const res = await fetch(`https://api.solarmanpv.com${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  // Fail on HTTP error OR explicit success=false
  if (!res.ok || json.success === false) {
    throw new Error(json.msg || json.message || `Solarman API error ${res.status}`);
  }

  return json;
}

interface NormalizedPlant {
  external_id: string;
  name: string;
  capacity_kw: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  metadata: Record<string, unknown>;
}

function normalizePlantStatus(raw: number | string | undefined): string {
  const map: Record<string, string> = {
    "1": "normal",
    "2": "offline",
    "3": "alarm",
    "4": "no_communication",
  };
  return map[String(raw)] || "unknown";
}

function normalizePlant(raw: Record<string, unknown>): NormalizedPlant {
  return {
    external_id: String(raw.stationId || raw.id || ""),
    name: String(raw.stationName || raw.name || ""),
    capacity_kw: raw.installedCapacity != null ? Number(raw.installedCapacity) : null,
    address: raw.locationAddress ? String(raw.locationAddress) : null,
    latitude: raw.latitude != null ? Number(raw.latitude) : null,
    longitude: raw.longitude != null ? Number(raw.longitude) : null,
    status: normalizePlantStatus(raw.status as number),
    metadata: raw,
  };
}

async function listSolarmanPlants(token: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let page = 1;
  const size = 100;

  while (true) {
    const json = await solarmanFetch("/station/v1.0/list", token, { page, size });
    const stationList = (json.stationList || json.data || []) as Record<string, unknown>[];
    if (!stationList.length) break;
    for (const raw of stationList) {
      plants.push(normalizePlant(raw));
    }
    const total = (json.total as number) || 0;
    if (page * size >= total) break;
    page++;
  }

  return plants;
}

async function fetchPlantRealtime(token: string, externalId: string) {
  try {
    const json = await solarmanFetch("/station/v1.0/realTime", token, {
      stationId: Number(externalId),
    });

    return {
      power_kw: json.generationPower != null ? Number(json.generationPower) / 1000 : null,
      energy_kwh: json.generationValue != null ? Number(json.generationValue) : null,
      total_energy_kwh: json.totalGenerationValue != null
        ? Number(json.totalGenerationValue)
        : json.generationTotal != null
          ? Number(json.generationTotal)
          : null,
      metadata: json,
    };
  } catch {
    return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
  }
}

// ─── Main handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return jsonResponse({ error: "Tenant not found" }, 403);
    }
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const provider = body.provider || "solarman_business";
    const mode = body.mode || "full";

    // Load integration
    const { data: integration, error: intErr } = await supabaseAdmin
      .from("monitoring_integrations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (intErr || !integration) {
      return jsonResponse({ error: "Integration not found. Connect first." }, 404);
    }

    const tokens = integration.tokens as Record<string, unknown>;
    const accessToken = tokens?.access_token as string;

    if (!accessToken) {
      return jsonResponse({ error: "No access token. Reconnect integration." }, 400);
    }

    // Check token expiration
    const expiresAt = tokens?.expires_at ? new Date(tokens.expires_at as string) : null;
    if (expiresAt && expiresAt < new Date()) {
      await supabaseAdmin
        .from("monitoring_integrations")
        .update({
          status: "error",
          sync_error: "Token expired. Reconnect.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      return jsonResponse({ error: "Token expired. Please reconnect." }, 401);
    }

    let plantsUpserted = 0;
    let metricsUpserted = 0;
    const errors: string[] = [];

    // ── Sync plants ──
    if (mode === "plants" || mode === "full") {
      try {
        const plants = await listSolarmanPlants(accessToken);

        for (const plant of plants) {
          const { error: plantErr } = await supabaseAdmin
            .from("solar_plants")
            .upsert(
              {
                tenant_id: tenantId,
                integration_id: integration.id,
                provider,
                external_id: plant.external_id,
                name: plant.name,
                capacity_kw: plant.capacity_kw,
                address: plant.address,
                latitude: plant.latitude,
                longitude: plant.longitude,
                status: plant.status,
                metadata: plant.metadata,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,provider,external_id" },
            );

          if (plantErr) {
            errors.push(`Plant ${plant.external_id}: ${plantErr.message}`);
          } else {
            plantsUpserted++;
          }
        }
      } catch (err) {
        errors.push(`listPlants: ${(err as Error).message}`);
      }
    }

    // ── Sync metrics ──
    if (mode === "metrics" || mode === "full") {
      const { data: dbPlants } = await supabaseAdmin
        .from("solar_plants")
        .select("id, external_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integration.id);

      const today = new Date().toISOString().slice(0, 10);

      for (const dbPlant of dbPlants || []) {
        try {
          const metrics = await fetchPlantRealtime(accessToken, dbPlant.external_id);
          const { error: metricErr } = await supabaseAdmin
            .from("solar_plant_metrics_daily")
            .upsert(
              {
                tenant_id: tenantId,
                plant_id: dbPlant.id,
                date: today,
                energy_kwh: metrics.energy_kwh,
                power_kw: metrics.power_kw,
                total_energy_kwh: metrics.total_energy_kwh,
                metadata: metrics.metadata,
              },
              { onConflict: "tenant_id,plant_id,date" },
            );

          if (metricErr) {
            errors.push(`Metrics ${dbPlant.external_id}: ${metricErr.message}`);
          } else {
            metricsUpserted++;
          }
        } catch (err) {
          errors.push(`Metrics ${dbPlant.external_id}: ${(err as Error).message}`);
        }
      }
    }

    // Update integration status
    const newStatus = errors.length > 0 ? "error" : "connected";
    await supabaseAdmin
      .from("monitoring_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        status: newStatus,
        sync_error: errors.length > 0 ? errors.join("; ").slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      acao: "monitoring.sync.run",
      tabela: "monitoring_integrations",
      registro_id: integration.id,
      dados_novos: { provider, mode, plantsUpserted, metricsUpserted, errors: errors.length },
    });

    return jsonResponse({
      success: true,
      plants_synced: plantsUpserted,
      metrics_synced: metricsUpserted,
      errors,
    });
  } catch (err) {
    console.error("monitoring-sync error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
