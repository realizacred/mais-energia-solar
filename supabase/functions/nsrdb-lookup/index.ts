import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * NSRDB Lookup Edge Function
 * 
 * Queries the NREL NSRDB GOES Full Disc (PSM v4) API for high-resolution
 * solar irradiance data (2km resolution) at a specific coordinate.
 * 
 * Strategy:
 *   1. Check irradiance_lookup_cache for cached NSRDB result
 *   2. If miss → query NSRDB API (hourly data for 1 year)
 *   3. Aggregate to monthly GHI + DHI averages
 *   4. Cache result + return
 *   5. If NSRDB fails → return error (caller handles fallback)
 */

const NSRDB_BASE = "https://developer.nrel.gov/api/nsrdb/v2/solar/nsrdb-GOES-full-disc-v4-0-0-download.csv";
const NSRDB_YEAR = "2022"; // Most recent complete year with good coverage

interface LookupRequest {
  lat: number;
  lon: number;
  /** If provided, cache with this version_id */
  version_id?: string;
}

interface MonthlyAvg {
  month: number; // 1-12
  ghi: number;   // kWh/m²/day
  dhi: number;   // kWh/m²/day
}

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

/**
 * Parse NSRDB CSV response into monthly GHI/DHI averages (kWh/m²/day).
 * NSRDB returns hourly W/m² values. We convert:
 *   daily_kwh_m2 = sum(hourly_W_m2) / 1000
 *   monthly_avg = mean(daily_kwh_m2) for each month
 */
function parseNsrdbCsv(csvText: string): MonthlyAvg[] {
  const lines = csvText.split("\n");
  
  // NSRDB CSV has 2 header lines: metadata + column names
  // Find the header line with "Year,Month,Day,Hour,Minute,..."
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith("Year,") || lines[i].includes("Year,Month,Day")) {
      headerIdx = i;
      break;
    }
  }
  
  if (headerIdx === -1) {
    throw new Error("Could not find NSRDB CSV header");
  }
  
  const headers = lines[headerIdx].split(",").map(h => h.trim().toLowerCase());
  const ghiIdx = headers.indexOf("ghi");
  const dhiIdx = headers.indexOf("dhi");
  const monthIdx = headers.indexOf("month");
  const dayIdx = headers.indexOf("day");
  const hourIdx = headers.indexOf("hour");
  
  if (ghiIdx === -1 || monthIdx === -1) {
    throw new Error(`NSRDB CSV missing required columns. Found: ${headers.join(", ")}`);
  }
  
  // Accumulate daily totals per month
  // Structure: { month -> { day -> { ghi_sum_wh, dhi_sum_wh } } }
  const monthDays: Record<number, Record<number, { ghi: number; dhi: number }>> = {};
  
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(",");
    const month = parseInt(cols[monthIdx]);
    const day = parseInt(cols[dayIdx]);
    const ghi = parseFloat(cols[ghiIdx]); // W/m²
    const dhi = dhiIdx >= 0 ? parseFloat(cols[dhiIdx]) : 0;
    
    if (isNaN(month) || isNaN(day) || isNaN(ghi)) continue;
    
    if (!monthDays[month]) monthDays[month] = {};
    if (!monthDays[month][day]) monthDays[month][day] = { ghi: 0, dhi: 0 };
    
    // Each hourly value in W/m² → accumulate as Wh/m² (1 hour interval)
    monthDays[month][day].ghi += Math.max(0, ghi);
    monthDays[month][day].dhi += Math.max(0, isNaN(dhi) ? 0 : dhi);
  }
  
  // Convert to monthly averages in kWh/m²/day
  const results: MonthlyAvg[] = [];
  for (let m = 1; m <= 12; m++) {
    const days = monthDays[m];
    if (!days) {
      results.push({ month: m, ghi: 0, dhi: 0 });
      continue;
    }
    
    const dayValues = Object.values(days);
    const avgGhi = dayValues.reduce((s, d) => s + d.ghi, 0) / dayValues.length / 1000; // Wh→kWh
    const avgDhi = dayValues.reduce((s, d) => s + d.dhi, 0) / dayValues.length / 1000;
    
    results.push({
      month: m,
      ghi: Math.round(avgGhi * 10000) / 10000,
      dhi: Math.round(avgDhi * 10000) / 10000,
    });
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const nrelApiKey = Deno.env.get("NREL_API_KEY");

  if (!nrelApiKey) {
    return err("NREL_API_KEY not configured", 500);
  }

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
    const body: LookupRequest = await req.json();
    const { lat, lon } = body;

    if (lat == null || lon == null) {
      return err("Missing lat or lon");
    }

    // Validate Brazil bounding box (with margin)
    if (lat < -35 || lat > 7 || lon < -75 || lon > -33) {
      return err("Coordinates outside Brazil coverage area");
    }

    const latR = roundCoord(lat);
    const lonR = roundCoord(lon);
    const cacheMethod = "nsrdb_api";

    console.log(`[NSRDB_LOOKUP] Request for (${latR}, ${lonR}) by user=${user.id}`);

    // 1. Check cache
    const { data: cached } = await admin
      .from("irradiance_lookup_cache")
      .select("series, point_lat, point_lon, distance_km")
      .eq("lat_round", latR)
      .eq("lon_round", lonR)
      .eq("method", cacheMethod)
      .maybeSingle();

    if (cached) {
      console.log(`[NSRDB_LOOKUP] Cache hit for (${latR}, ${lonR})`);
      return ok({
        success: true,
        source: "nsrdb",
        cache_hit: true,
        series: cached.series,
        point_lat: cached.point_lat,
        point_lon: cached.point_lon,
        distance_km: cached.distance_km ?? 0,
      });
    }

    // 2. Query NSRDB API
    const wkt = `POINT(${lon} ${lat})`;
    const nsrdbUrl = `${NSRDB_BASE}?api_key=${nrelApiKey}&wkt=${encodeURIComponent(wkt)}&attributes=ghi,dhi&names=${NSRDB_YEAR}&interval=60&utc=false&leap_day=false&email=api@maisenergia.solar`;

    console.log(`[NSRDB_LOOKUP] Querying NSRDB API…`);
    const startTime = Date.now();

    const nsrdbResp = await fetch(nsrdbUrl, {
      headers: { Accept: "text/csv" },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[NSRDB_LOOKUP] NSRDB response: ${nsrdbResp.status} (${elapsed}ms)`);

    if (!nsrdbResp.ok) {
      const errorText = await nsrdbResp.text();
      console.error(`[NSRDB_LOOKUP] NSRDB API error: ${nsrdbResp.status} — ${errorText.slice(0, 500)}`);
      return err(`NSRDB API error: ${nsrdbResp.status}`, 502);
    }

    const csvText = await nsrdbResp.text();

    if (!csvText || csvText.length < 100) {
      console.error(`[NSRDB_LOOKUP] NSRDB returned empty/short response`);
      return err("NSRDB returned no data for this location", 404);
    }

    // 3. Parse and aggregate
    const monthlyData = parseNsrdbCsv(csvText);

    const series: Record<string, number> = {};
    const dhiSeries: Record<string, number> = {};
    for (const m of monthlyData) {
      const key = `m${String(m.month).padStart(2, "0")}`;
      series[key] = m.ghi;
      dhiSeries[`dhi_${key}`] = m.dhi;
    }

    const annualAvg = monthlyData.reduce((s, m) => s + m.ghi, 0) / 12;

    // 4. Cache result (fire-and-forget)
    const cachePayload = {
      version_id: body.version_id || null,
      lat_round: latR,
      lon_round: lonR,
      method: cacheMethod,
      series: { ...series, ...dhiSeries },
      point_lat: latR,
      point_lon: lonR,
      distance_km: 0, // NSRDB is point-precise (2km grid)
    };

    // Only cache if we have a version_id (cache table requires it)
    if (body.version_id) {
      admin
        .from("irradiance_lookup_cache")
        .upsert(cachePayload, { onConflict: "version_id,lat_round,lon_round,method" })
        .then(() => {});
    }

    console.log(`[NSRDB_LOOKUP] SUCCESS — annual_avg=${annualAvg.toFixed(2)} kWh/m²/day`);

    return ok({
      success: true,
      source: "nsrdb",
      cache_hit: false,
      series,
      dhi_series: dhiSeries,
      annual_average: Math.round(annualAvg * 10000) / 10000,
      point_lat: latR,
      point_lon: lonR,
      distance_km: 0,
      unit: "kwh_m2_day",
      api_response_ms: elapsed,
      year: NSRDB_YEAR,
    });
  } catch (error: any) {
    console.error(`[NSRDB_LOOKUP] FAILED:`, error.message);
    return err(error.message, 500);
  }
});
