import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

const SYNC_IMPLEMENTED = new Set(["solarman_business_api", "solaredge", "solis_cloud"]);

// ═══════════════════════════════════════════════════════════
// Shared types
// ═══════════════════════════════════════════════════════════

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

interface DailyMetrics {
  power_kw: number | null;
  energy_kwh: number | null;
  total_energy_kwh: number | null;
  metadata: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════
// Solarman Business API
// ═══════════════════════════════════════════════════════════

async function solarmanFetch(endpoint: string, token: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.solarmanpv.com${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.msg || json.message || `Solarman API error ${res.status}`);
  }
  return json;
}

function solarmanNormalizeStatus(raw: number | string | undefined): string {
  const map: Record<string, string> = { "1": "normal", "2": "offline", "3": "alarm", "4": "no_communication" };
  return map[String(raw)] || "unknown";
}

async function solarmanListPlants(token: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let page = 1;
  const size = 100;
  while (true) {
    const json = await solarmanFetch("/station/v1.0/list", token, { page, size });
    const list = (json.stationList || json.data || []) as Record<string, unknown>[];
    if (!list.length) break;
    for (const raw of list) {
      plants.push({
        external_id: String(raw.stationId || raw.id || ""),
        name: String(raw.stationName || raw.name || ""),
        capacity_kw: raw.installedCapacity != null ? Number(raw.installedCapacity) : null,
        address: raw.locationAddress ? String(raw.locationAddress) : null,
        latitude: raw.latitude != null ? Number(raw.latitude) : null,
        longitude: raw.longitude != null ? Number(raw.longitude) : null,
        status: solarmanNormalizeStatus(raw.status as number),
        metadata: raw,
      });
    }
    if (page * size >= ((json.total as number) || 0)) break;
    page++;
  }
  return plants;
}

async function solarmanFetchMetrics(token: string, externalId: string): Promise<DailyMetrics> {
  try {
    const json = await solarmanFetch("/station/v1.0/realTime", token, { stationId: Number(externalId) });
    return {
      power_kw: json.generationPower != null ? Number(json.generationPower) / 1000 : null,
      energy_kwh: json.generationValue != null ? Number(json.generationValue) : null,
      total_energy_kwh: json.totalGenerationValue != null ? Number(json.totalGenerationValue) : json.generationTotal != null ? Number(json.generationTotal) : null,
      metadata: json,
    };
  } catch {
    return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
  }
}

// ═══════════════════════════════════════════════════════════
// SolarEdge Monitoring API
// ═══════════════════════════════════════════════════════════

const SOLAREDGE_BASE = "https://monitoringapi.solaredge.com";

function solaredgeNormalizeStatus(raw: string | undefined): string {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (s === "active") return "normal";
  if (s === "pending" || s === "disabled") return "offline";
  return "unknown";
}

async function solaredgeListSites(apiKey: string): Promise<NormalizedPlant[]> {
  const res = await fetch(`${SOLAREDGE_BASE}/sites/list?api_key=${encodeURIComponent(apiKey)}&size=100`);
  if (!res.ok) { const t = await res.text(); throw new Error(`SolarEdge sites/list ${res.status}: ${t.slice(0,200)}`); }
  const json = await res.json();
  const sites = (json.sites?.site || []) as Record<string, unknown>[];
  return sites.map((s) => ({
    external_id: String(s.id),
    name: String(s.name || ""),
    capacity_kw: s.peakPower != null ? Number(s.peakPower) : null,
    address: [s.address?.address, s.address?.city, s.address?.country].filter(Boolean).join(", ") || null,
    latitude: (s.location as Record<string,unknown>)?.latitude != null ? Number((s.location as Record<string,unknown>).latitude) : null,
    longitude: (s.location as Record<string,unknown>)?.longitude != null ? Number((s.location as Record<string,unknown>).longitude) : null,
    status: solaredgeNormalizeStatus(s.status as string),
    metadata: s,
  }));
}

async function solaredgeFetchDailyEnergy(apiKey: string, siteId: string): Promise<DailyMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Site energy for today
    const res = await fetch(
      `${SOLAREDGE_BASE}/site/${siteId}/energy?timeUnit=DAY&startDate=${today}&endDate=${today}&api_key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) { await res.text(); return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} }; }
    const json = await res.json();
    const values = (json.energy?.values || []) as { value: number | null }[];
    const todayValue = values[0]?.value;
    const energyKwh = todayValue != null ? todayValue / 1000 : null; // API returns Wh

    // Overview for lifetime/current power
    const ovRes = await fetch(`${SOLAREDGE_BASE}/site/${siteId}/overview?api_key=${encodeURIComponent(apiKey)}`);
    let powerKw: number | null = null;
    let totalEnergyKwh: number | null = null;
    if (ovRes.ok) {
      const ovJson = await ovRes.json();
      const ov = ovJson.overview;
      if (ov?.currentPower?.power != null) powerKw = Number(ov.currentPower.power) / 1000; // W→kW
      if (ov?.lifeTimeData?.energy != null) totalEnergyKwh = Number(ov.lifeTimeData.energy) / 1000; // Wh→kWh
    } else {
      await ovRes.text();
    }

    return { power_kw: powerKw, energy_kwh: energyKwh, total_energy_kwh: totalEnergyKwh, metadata: json };
  } catch {
    return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
  }
}

// ═══════════════════════════════════════════════════════════
// SolisCloud Platform API V2.0 (HMAC-SHA1 signed)
// ═══════════════════════════════════════════════════════════

async function solisContentMd5(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(body));
  return base64Encode(new Uint8Array(hash));
}

async function solisSign(apiSecret: string, contentMd5: string, contentType: string, dateStr: string, path: string): Promise<string> {
  const stringToSign = `POST\n${contentMd5}\n${contentType}\n${dateStr}\n${path}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(stringToSign));
  return base64Encode(new Uint8Array(sig));
}

async function solisFetch(apiId: string, apiSecret: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const bodyStr = JSON.stringify(body);
  const contentMd5 = await solisContentMd5(bodyStr);
  const contentType = "application/json;charset=UTF-8";
  const dateStr = new Date().toUTCString();
  const sign = await solisSign(apiSecret, contentMd5, contentType, dateStr, path);

  const res = await fetch(`https://www.soliscloud.com:13333${path}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "Content-MD5": contentMd5,
      "Date": dateStr,
      "Authorization": `API ${apiId}:${sign}`,
    },
    body: bodyStr,
  });
  const json = await res.json();
  if (!json.success && json.code !== "0") {
    throw new Error(json.msg || `SolisCloud error (code=${json.code})`);
  }
  return json;
}

function solisNormalizeStatus(raw: number | string | undefined): string {
  const s = String(raw);
  if (s === "1") return "normal";
  if (s === "2") return "offline";
  if (s === "3") return "alarm";
  return "unknown";
}

async function solisListPlants(apiId: string, apiSecret: string): Promise<NormalizedPlant[]> {
  const plants: NormalizedPlant[] = [];
  let pageNo = 1;
  const pageSize = 100;
  while (true) {
    const json = await solisFetch(apiId, apiSecret, "/v1/api/userStationList", { pageNo, pageSize });
    const data = json.data as { page?: { records?: Record<string, unknown>[] }; records?: Record<string, unknown>[] } | undefined;
    const records = data?.page?.records || data?.records || [];
    if (!records.length) break;
    for (const raw of records) {
      plants.push({
        external_id: String(raw.id || raw.sno || ""),
        name: String(raw.stationName || raw.sno || ""),
        capacity_kw: raw.installedCapacity != null ? Number(raw.installedCapacity) : raw.capacity != null ? Number(raw.capacity) : null,
        address: raw.city ? String(raw.city) : null,
        latitude: raw.latitude != null ? Number(raw.latitude) : null,
        longitude: raw.longitude != null ? Number(raw.longitude) : null,
        status: solisNormalizeStatus(raw.state as number),
        metadata: raw,
      });
    }
    const total = (data?.page as Record<string, unknown>)?.total || 0;
    if (pageNo * pageSize >= Number(total)) break;
    pageNo++;
  }
  return plants;
}

async function solisFetchDayMetrics(apiId: string, apiSecret: string, stationId: string): Promise<DailyMetrics> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const json = await solisFetch(apiId, apiSecret, "/v1/api/stationDay", {
      id: stationId,
      money: "CNY",
      time: today,
      timeZone: 0,
    });
    const data = json.data as Record<string, unknown> | undefined;

    return {
      power_kw: data?.pac != null ? Number(data.pac) / 1000 : null,
      energy_kwh: data?.eToday != null ? Number(data.eToday) : data?.dayEnergy != null ? Number(data.dayEnergy) : null,
      total_energy_kwh: data?.eTotal != null ? Number(data.eTotal) : data?.allEnergy != null ? Number(data.allEnergy) : null,
      metadata: data || {},
    };
  } catch {
    return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: {} };
  }
}

// ═══════════════════════════════════════════════════════════
// Generic sync orchestrator
// ═══════════════════════════════════════════════════════════

interface SyncContext {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string;
  userId: string;
  provider: string;
  integrationId: string;
}

async function upsertPlants(ctx: SyncContext, plants: NormalizedPlant[]): Promise<{ count: number; errors: string[] }> {
  let count = 0;
  const errors: string[] = [];
  for (const plant of plants) {
    const { error } = await ctx.supabaseAdmin
      .from("solar_plants")
      .upsert(
        {
          tenant_id: ctx.tenantId,
          integration_id: ctx.integrationId,
          provider: ctx.provider,
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
    if (error) errors.push(`Plant ${plant.external_id}: ${error.message}`);
    else count++;
  }
  return { count, errors };
}

async function upsertMetrics(
  ctx: SyncContext,
  plantId: string,
  metrics: DailyMetrics,
): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await ctx.supabaseAdmin
    .from("solar_plant_metrics_daily")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        plant_id: plantId,
        date: today,
        energy_kwh: metrics.energy_kwh,
        power_kw: metrics.power_kw,
        total_energy_kwh: metrics.total_energy_kwh,
        metadata: metrics.metadata,
      },
      { onConflict: "tenant_id,plant_id,date" },
    );
  return error ? error.message : null;
}

// ═══════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: profile } = await supabaseAdmin.from("profiles").select("tenant_id").eq("user_id", userId).single();
    if (!profile?.tenant_id) return jsonResponse({ error: "Tenant not found" }, 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const provider = body.provider || "solarman_business_api";
    const mode = body.mode || "full";

    if (!SYNC_IMPLEMENTED.has(provider)) {
      return jsonResponse({ error: `Provider sync not implemented yet: ${provider}` }, 501);
    }

    const { data: integration, error: intErr } = await supabaseAdmin
      .from("monitoring_integrations")
      .select("id, tokens, credentials, status")
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .single();

    if (intErr || !integration) {
      return jsonResponse({ error: "Integration not found. Connect first." }, 404);
    }

    const tokens = (integration.tokens || {}) as Record<string, unknown>;
    const credentials = (integration.credentials || {}) as Record<string, unknown>;

    const ctx: SyncContext = { supabaseAdmin, tenantId, userId, provider, integrationId: integration.id };

    let plantsUpserted = 0;
    let metricsUpserted = 0;
    const errors: string[] = [];

    // ── Provider-specific sync ──

    if (provider === "solarman_business_api") {
      const accessToken = tokens.access_token as string;
      if (!accessToken) return jsonResponse({ error: "No access token. Reconnect." }, 400);
      const expiresAt = tokens.expires_at ? new Date(tokens.expires_at as string) : null;
      if (expiresAt && expiresAt < new Date()) {
        await supabaseAdmin.from("monitoring_integrations").update({ status: "error", sync_error: "Token expired. Reconnect.", updated_at: new Date().toISOString() }).eq("id", integration.id);
        return jsonResponse({ error: "Token expired. Please reconnect." }, 401);
      }

      if (mode === "plants" || mode === "full") {
        try {
          const plants = await solarmanListPlants(accessToken);
          const result = await upsertPlants(ctx, plants);
          plantsUpserted = result.count;
          errors.push(...result.errors);
        } catch (err) { errors.push(`listPlants: ${(err as Error).message}`); }
      }

      if (mode === "metrics" || mode === "full") {
        const { data: dbPlants } = await supabaseAdmin.from("solar_plants").select("id, external_id").eq("tenant_id", tenantId).eq("integration_id", integration.id);
        for (const p of dbPlants || []) {
          const metrics = await solarmanFetchMetrics(accessToken, p.external_id);
          const err = await upsertMetrics(ctx, p.id, metrics);
          if (err) errors.push(`Metrics ${p.external_id}: ${err}`);
          else metricsUpserted++;
        }
      }
    }

    if (provider === "solaredge") {
      const apiKey = credentials.apiKey as string;
      if (!apiKey) return jsonResponse({ error: "No API key. Reconnect." }, 400);

      if (mode === "plants" || mode === "full") {
        try {
          const plants = await solaredgeListSites(apiKey);
          const result = await upsertPlants(ctx, plants);
          plantsUpserted = result.count;
          errors.push(...result.errors);
        } catch (err) { errors.push(`listSites: ${(err as Error).message}`); }
      }

      if (mode === "metrics" || mode === "full") {
        const { data: dbPlants } = await supabaseAdmin.from("solar_plants").select("id, external_id").eq("tenant_id", tenantId).eq("integration_id", integration.id);
        for (const p of dbPlants || []) {
          const metrics = await solaredgeFetchDailyEnergy(apiKey, p.external_id);
          const err = await upsertMetrics(ctx, p.id, metrics);
          if (err) errors.push(`Metrics ${p.external_id}: ${err}`);
          else metricsUpserted++;
        }
      }
    }

    if (provider === "solis_cloud") {
      const apiId = credentials.apiId as string;
      const apiSecret = tokens.apiSecret as string;
      if (!apiId || !apiSecret) return jsonResponse({ error: "Missing API credentials. Reconnect." }, 400);

      if (mode === "plants" || mode === "full") {
        try {
          const plants = await solisListPlants(apiId, apiSecret);
          const result = await upsertPlants(ctx, plants);
          plantsUpserted = result.count;
          errors.push(...result.errors);
        } catch (err) { errors.push(`listPlants: ${(err as Error).message}`); }
      }

      if (mode === "metrics" || mode === "full") {
        const { data: dbPlants } = await supabaseAdmin.from("solar_plants").select("id, external_id").eq("tenant_id", tenantId).eq("integration_id", integration.id);
        for (const p of dbPlants || []) {
          const metrics = await solisFetchDayMetrics(apiId, apiSecret, p.external_id);
          const err = await upsertMetrics(ctx, p.id, metrics);
          if (err) errors.push(`Metrics ${p.external_id}: ${err}`);
          else metricsUpserted++;
        }
      }
    }

    // Update integration status
    const newStatus = errors.length > 0 ? "error" : "connected";
    await supabaseAdmin.from("monitoring_integrations").update({
      last_sync_at: new Date().toISOString(),
      status: newStatus,
      sync_error: errors.length > 0 ? errors.join("; ").slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", integration.id);

    // Audit
    await supabaseAdmin.from("audit_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      acao: "monitoring.sync.run",
      tabela: "monitoring_integrations",
      registro_id: integration.id,
      dados_novos: { provider, mode, plantsUpserted, metricsUpserted, errors: errors.length },
    });

    return jsonResponse({ success: true, plants_synced: plantsUpserted, metrics_synced: metricsUpserted, errors });
  } catch (err) {
    console.error("monitoring-sync error:", err);
    return jsonResponse({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
