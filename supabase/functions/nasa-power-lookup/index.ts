import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * NASA POWER Lookup Edge Function
 *
 * Queries the NASA POWER API v2 directly for a specific coordinate,
 * returning monthly GHI and DHI averages interpolated to the exact point.
 *
 * This is Tier 2 (secondary) in the triple-source irradiance strategy:
 *   Tier 1: NSRDB (2km resolution)   — PRIMARY
 *   Tier 2: NASA POWER API (exact)   — SECONDARY (this function)
 *   Tier 3: Local stored grid         — LAST RESORT
 *
 * API: https://power.larc.nasa.gov/api/temporal/climatology/point
 * Resolution: ~0.5° grid, but API interpolates to exact coordinate
 * Data: 30-year climatology (reliable long-term averages)
 */

const NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point";

// GHI = ALLSKY_SFC_SW_DWN, DHI = ALLSKY_SFC_SW_DIFF
const PARAMETERS = "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF";

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function roundCoord(v: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth — require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return err("Unauthorized", 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return err("Unauthorized", 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { lat, lon } = body;

    if (lat == null || lon == null) {
      return err("Missing lat or lon");
    }

    // Basic validation (global coverage, not just Brazil)
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return err("Invalid coordinates");
    }

    const latR = roundCoord(lat);
    const lonR = roundCoord(lon);
    const cacheMethod = "nasa_power_api";

    console.log(`[NASA_POWER_LOOKUP] Request for (${latR}, ${lonR}) by user=${user.id}`);

    // 1. Check cache
    const { data: cached } = await admin
      .from("irradiance_lookup_cache")
      .select("series, point_lat, point_lon, distance_km")
      .eq("lat_round", latR)
      .eq("lon_round", lonR)
      .eq("method", cacheMethod)
      .maybeSingle();

    if (cached) {
      console.log(`[NASA_POWER_LOOKUP] Cache hit for (${latR}, ${lonR})`);
      
      // Separate GHI and DHI from cached series
      const cachedSeries = cached.series as Record<string, number>;
      const ghiSeries: Record<string, number> = {};
      const dhiSeries: Record<string, number> = {};
      
      for (const [key, val] of Object.entries(cachedSeries)) {
        if (key.startsWith("dhi_")) {
          dhiSeries[key] = val;
        } else if (key.startsWith("m")) {
          ghiSeries[key] = val;
        }
      }
      
      return ok({
        success: true,
        source: "nasa_power_api",
        cache_hit: true,
        series: ghiSeries,
        dhi_series: dhiSeries,
        point_lat: cached.point_lat,
        point_lon: cached.point_lon,
        distance_km: cached.distance_km ?? 0,
      });
    }

    // 2. Query NASA POWER API
    const url = `${NASA_POWER_BASE}?parameters=${PARAMETERS}&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;

    console.log(`[NASA_POWER_LOOKUP] Querying NASA POWER API…`);
    const startTime = Date.now();

    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[NASA_POWER_LOOKUP] NASA response: ${resp.status} (${elapsed}ms)`);

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error(`[NASA_POWER_LOOKUP] NASA API error: ${resp.status} — ${errorText.slice(0, 500)}`);
      return err(`NASA POWER API error: ${resp.status}`, 502);
    }

    const data = await resp.json();

    // 3. Extract monthly values
    // NASA POWER returns: { properties: { parameter: { ALLSKY_SFC_SW_DWN: { "1": val, ... "12": val, "13": annual } } } }
    const params = data?.properties?.parameter;
    if (!params) {
      console.error(`[NASA_POWER_LOOKUP] Unexpected response structure`);
      return err("NASA POWER returned unexpected data format", 502);
    }

    const ghiData = params.ALLSKY_SFC_SW_DWN;
    const dhiData = params.ALLSKY_SFC_SW_DIFF;

    if (!ghiData) {
      return err("NASA POWER returned no GHI data for this location", 404);
    }

    // Build monthly series (keys "1" through "12")
    const series: Record<string, number> = {};
    const dhiSeries: Record<string, number> = {};

    for (let m = 1; m <= 12; m++) {
      const key = `m${String(m).padStart(2, "0")}`;
      const mStr = String(m);
      
      // NASA POWER values are in kWh/m²/day already
      series[key] = Math.round((ghiData[mStr] ?? 0) * 10000) / 10000;
      dhiSeries[`dhi_${key}`] = Math.round(((dhiData?.[mStr] ?? 0)) * 10000) / 10000;
    }

    const annualAvg = Object.values(series).reduce((a, b) => a + b, 0) / 12;

    // 4. Cache result (fire-and-forget, no version_id needed — use a synthetic one)
    const cachePayload = {
      version_id: body.version_id || null,
      lat_round: latR,
      lon_round: lonR,
      method: cacheMethod,
      series: { ...series, ...dhiSeries },
      point_lat: latR,
      point_lon: lonR,
      distance_km: 0, // API interpolates to exact point
    };

    if (body.version_id) {
      admin
        .from("irradiance_lookup_cache")
        .upsert(cachePayload, { onConflict: "version_id,lat_round,lon_round,method" })
        .then(() => {});
    }

    console.log(`[NASA_POWER_LOOKUP] SUCCESS — annual_avg=${annualAvg.toFixed(2)} kWh/m²/day (${elapsed}ms)`);

    return ok({
      success: true,
      source: "nasa_power_api",
      cache_hit: false,
      series,
      dhi_series: dhiSeries,
      annual_average: Math.round(annualAvg * 10000) / 10000,
      point_lat: latR,
      point_lon: lonR,
      distance_km: 0,
      unit: "kwh_m2_day",
      api_response_ms: elapsed,
      climatology: "30-year average",
    });
  } catch (error: any) {
    console.error(`[NASA_POWER_LOOKUP] FAILED:`, error.message);
    return err(error.message, 500);
  }
});
