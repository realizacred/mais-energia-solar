/**
 * IrradianceProvider — Canonical irradiance lookup service.
 *
 * DUAL-SOURCE STRATEGY:
 *   TIER 1 (PRIMARY):   Local stored grid (Atlas INPE — nearest-point lookup)
 *   TIER 2 (SECONDARY): NSRDB/NREL API (2km resolution, ±3-5% error)
 *
 * Each result includes "source attribution" (data pedigree) for audit trail.
 */

import { supabase } from "@/integrations/supabase/client";
import type { DhiSeries } from "./solar-transposition";

// ─── Types ──────────────────────────────────────────────────────

export interface IrradianceSeries {
  m01: number; m02: number; m03: number; m04: number;
  m05: number; m06: number; m07: number; m08: number;
  m09: number; m10: number; m11: number; m12: number;
}

export interface IrradianceLookupResult {
  /** GHI monthly series (kWh/m²/day) */
  series: IrradianceSeries;
  /** DHI monthly series if available (kWh/m²/day) */
  dhi_series: DhiSeries | null;
  annual_average: number;
  dataset_code: string;
  version_tag: string;
  version_id: string;
  method: string;
  unit: string;
  point_lat: number;
  point_lon: number;
  distance_km: number;
  cache_hit: boolean;
  resolved_at: string;
  /** Whether DHI data was available from the dataset */
  has_dhi: boolean;
  /** Data source: 'nsrdb' | 'local_grid' | 'cache' */
  source: string;
  /** Source tier for audit: 1=Local Grid, 2=NSRDB */
  source_tier: 1 | 2;
}

export interface IrradianceLookupInput {
  lat: number;
  lon: number;
  tenant_id?: string;
  dataset_code_override?: string;
  version_id_override?: string;
  /** Force specific source: 'nsrdb' | 'local_grid' | 'auto' (default: auto) */
  source_preference?: "nsrdb" | "local_grid" | "auto";
}

interface TenantIrradianceConfig {
  dataset_code: string;
  version_id: string | null;
  lookup_method: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function roundCoord(v: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

function seriesAverage(s: IrradianceSeries): number {
  const vals = [s.m01, s.m02, s.m03, s.m04, s.m05, s.m06, s.m07, s.m08, s.m09, s.m10, s.m11, s.m12];
  return vals.reduce((a, b) => a + b, 0) / 12;
}

function extractDhi(pt: any): DhiSeries | null {
  const dhi: DhiSeries = {
    dhi_m01: Number(pt.dhi_m01 ?? 0), dhi_m02: Number(pt.dhi_m02 ?? 0),
    dhi_m03: Number(pt.dhi_m03 ?? 0), dhi_m04: Number(pt.dhi_m04 ?? 0),
    dhi_m05: Number(pt.dhi_m05 ?? 0), dhi_m06: Number(pt.dhi_m06 ?? 0),
    dhi_m07: Number(pt.dhi_m07 ?? 0), dhi_m08: Number(pt.dhi_m08 ?? 0),
    dhi_m09: Number(pt.dhi_m09 ?? 0), dhi_m10: Number(pt.dhi_m10 ?? 0),
    dhi_m11: Number(pt.dhi_m11 ?? 0), dhi_m12: Number(pt.dhi_m12 ?? 0),
  };
  return Object.values(dhi).some(v => v > 0) ? dhi : null;
}

function buildDhiFromRecord(rec: Record<string, number>): DhiSeries | null {
  // Support both formats: { dhi_m01: ... } and { m01: ... }
  const dhi: DhiSeries = {
    dhi_m01: rec.dhi_m01 ?? rec.m01 ?? 0, dhi_m02: rec.dhi_m02 ?? rec.m02 ?? 0,
    dhi_m03: rec.dhi_m03 ?? rec.m03 ?? 0, dhi_m04: rec.dhi_m04 ?? rec.m04 ?? 0,
    dhi_m05: rec.dhi_m05 ?? rec.m05 ?? 0, dhi_m06: rec.dhi_m06 ?? rec.m06 ?? 0,
    dhi_m07: rec.dhi_m07 ?? rec.m07 ?? 0, dhi_m08: rec.dhi_m08 ?? rec.m08 ?? 0,
    dhi_m09: rec.dhi_m09 ?? rec.m09 ?? 0, dhi_m10: rec.dhi_m10 ?? rec.m10 ?? 0,
    dhi_m11: rec.dhi_m11 ?? rec.m11 ?? 0, dhi_m12: rec.dhi_m12 ?? rec.m12 ?? 0,
  };
  return Object.values(dhi).some(v => v > 0) ? dhi : null;
}

function buildSeriesFromData(data: any): IrradianceSeries {
  return {
    m01: data.m01 ?? 0, m02: data.m02 ?? 0, m03: data.m03 ?? 0, m04: data.m04 ?? 0,
    m05: data.m05 ?? 0, m06: data.m06 ?? 0, m07: data.m07 ?? 0, m08: data.m08 ?? 0,
    m09: data.m09 ?? 0, m10: data.m10 ?? 0, m11: data.m11 ?? 0, m12: data.m12 ?? 0,
  };
}

// ─── TIER 2: NSRDB Lookup (Secondary — 2km) ────────────────────

async function tryNsrdbLookup(
  lat: number, lon: number, versionId?: string
): Promise<IrradianceLookupResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("nsrdb-lookup", {
      body: { lat, lon, version_id: versionId },
    });

    if (error || !data?.success) {
      console.warn("[IrradianceProvider] TIER 2 NSRDB failed:", error?.message || data?.error);
      return null;
    }

    const series = buildSeriesFromData(data.series);
    const dhiSeries = data.dhi_series ? buildDhiFromRecord(data.dhi_series) : null;

    return {
      series,
      dhi_series: dhiSeries,
      annual_average: data.annual_average ?? seriesAverage(series),
      dataset_code: "NSRDB_GOES_PSM_V4",
      version_tag: `nsrdb-${data.year || "2022"}`,
      version_id: versionId || "nsrdb-api",
      method: "nsrdb_api",
      unit: "kwh_m2_day",
      point_lat: data.point_lat,
      point_lon: data.point_lon,
      distance_km: data.distance_km ?? 0,
      cache_hit: data.cache_hit ?? false,
      resolved_at: new Date().toISOString(),
      has_dhi: dhiSeries !== null,
      source: "nsrdb",
      source_tier: 2,
    };
  } catch (e: any) {
    console.warn("[IrradianceProvider] TIER 2 NSRDB exception:", e.message);
    return null;
  }
}

// ─── TIER 1: Local Grid (Primary — nearest stored point) ───────

const DEFAULT_DATASET_CODE = "INPE_2017_SUNDATA";

async function tryLocalGrid(
  lat: number, lon: number, config: TenantIrradianceConfig,
  versionId: string, versionTag: string
): Promise<IrradianceLookupResult> {
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);

  // Check cache first
  const { data: cached } = await supabase
    .from("irradiance_lookup_cache")
    .select("series, point_lat, point_lon, distance_km")
    .eq("version_id", versionId)
    .eq("lat_round", latR)
    .eq("lon_round", lonR)
    .eq("method", config.lookup_method)
    .maybeSingle();

  if (cached) {
    const raw = cached.series as any;
    // Handle two cache formats:
    // Format A (from irradiance-provider): { m01, m02, ... }
    // Format B (from get_irradiance_for_simulation RPC): { ghi: { m01, m02, ... }, dhi: {...}, ... }
    let series: IrradianceSeries;
    let dhiSeries: DhiSeries | null = null;
    let hasGhiWrapper = raw && typeof raw === "object" && raw.ghi && typeof raw.ghi === "object";

    if (hasGhiWrapper) {
      series = buildSeriesFromData(raw.ghi);
      if (raw.dhi) dhiSeries = buildDhiFromRecord(raw.dhi);
    } else if (raw && raw.m01 !== undefined) {
      series = raw as IrradianceSeries;
    } else {
      // Invalid cache entry — skip and do fresh lookup
      series = null as any;
    }

    if (series) {
      return {
        series,
        dhi_series: dhiSeries,
        annual_average: seriesAverage(series),
        dataset_code: hasGhiWrapper ? (raw.dataset_code || config.dataset_code) : config.dataset_code,
        version_tag: hasGhiWrapper ? (raw.version_tag || versionTag) : versionTag,
        version_id: versionId,
        method: config.lookup_method,
        unit: "kwh_m2_day",
        point_lat: Number(cached.point_lat),
        point_lon: Number(cached.point_lon),
        distance_km: Number(cached.distance_km),
        cache_hit: true,
        resolved_at: new Date().toISOString(),
        has_dhi: dhiSeries !== null,
        source: "local_grid",
        source_tier: 1,
      };
    }
  }

  // Nearest-point lookup via RPC
  const { data: points, error } = await supabase.rpc("irradiance_nearest_point", {
    p_version_id: versionId,
    p_lat: lat,
    p_lon: lon,
    p_radius_deg: 0.5,
  });

  if (error) throw new Error(`Irradiance lookup failed: ${error.message}`);
  if (!points || (points as any[]).length === 0) {
    throw new Error(`No irradiance data found within 0.5° of (${lat}, ${lon})`);
  }

  const pt = (points as any[])[0];
  const series: IrradianceSeries = {
    m01: Number(pt.m01), m02: Number(pt.m02), m03: Number(pt.m03), m04: Number(pt.m04),
    m05: Number(pt.m05), m06: Number(pt.m06), m07: Number(pt.m07), m08: Number(pt.m08),
    m09: Number(pt.m09), m10: Number(pt.m10), m11: Number(pt.m11), m12: Number(pt.m12),
  };

  const dhiSeries = extractDhi(pt);

  // Persist cache (fire-and-forget)
  supabase
    .from("irradiance_lookup_cache")
    .upsert({
      version_id: versionId,
      lat_round: latR,
      lon_round: lonR,
      method: config.lookup_method,
      series: series as any,
      point_lat: Number(pt.lat),
      point_lon: Number(pt.lon),
      distance_km: Number(pt.distance_km),
    }, { onConflict: "version_id,lat_round,lon_round,method" })
    .then(() => {});

  return {
    series,
    dhi_series: dhiSeries,
    annual_average: seriesAverage(series),
    dataset_code: config.dataset_code,
    version_tag: versionTag,
    version_id: versionId,
    method: config.lookup_method,
    unit: pt.unit || "kwh_m2_day",
    point_lat: Number(pt.lat),
    point_lon: Number(pt.lon),
    distance_km: Number(pt.distance_km),
    cache_hit: false,
    resolved_at: new Date().toISOString(),
    has_dhi: dhiSeries !== null,
    source: "local_grid",
    source_tier: 1,
  };
}

// ─── Main Provider (Dual-Source Strategy) ───────────────────────

export async function getMonthlyIrradiance(
  input: IrradianceLookupInput
): Promise<IrradianceLookupResult> {
  const { lat, lon } = input;
  const preference = input.source_preference || "auto";

  // 1. Resolve tenant config
  let config: TenantIrradianceConfig = {
    dataset_code: input.dataset_code_override || DEFAULT_DATASET_CODE,
    version_id: input.version_id_override || null,
    lookup_method: "nearest",
  };

  if (input.tenant_id && !input.dataset_code_override) {
    const { data: tenantCfg } = await supabase
      .from("tenant_irradiance_config")
      .select("dataset_code, version_id, lookup_method")
      .eq("tenant_id", input.tenant_id)
      .maybeSingle();

    if (tenantCfg) {
      config = tenantCfg as TenantIrradianceConfig;
    }
  }

  // 2. Resolve active version
  let versionId = config.version_id || "";
  let versionTag = "";

  if (!config.version_id) {
    const { data: ds } = await supabase
      .from("irradiance_datasets")
      .select("id")
      .eq("code", config.dataset_code)
      .single();

    if (ds) {
      const { data: ver } = await supabase
        .from("irradiance_dataset_versions")
        .select("id, version_tag")
        .eq("dataset_id", ds.id)
        .eq("status", "active")
        .order("ingested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ver) {
        versionId = ver.id;
        versionTag = ver.version_tag;
      }
    }
  } else {
    const { data: ver } = await supabase
      .from("irradiance_dataset_versions")
      .select("version_tag")
      .eq("id", versionId)
      .single();
    versionTag = ver?.version_tag || "unknown";
  }

  // ─── DUAL-SOURCE WATERFALL ─────────────────────────────────────

  // TIER 1: Local Grid (Atlas INPE — primary)
  if (versionId && (preference === "auto" || preference === "local_grid")) {
    try {
      const gridResult = await tryLocalGrid(lat, lon, config, versionId, versionTag);
      console.log(`[IrradianceProvider] ✅ TIER 1 Local Grid: ${gridResult.annual_average.toFixed(2)} kWh/m²/day`);
      return gridResult;
    } catch (e: any) {
      console.warn(`[IrradianceProvider] ⚠️ TIER 1 Local Grid failed: ${e.message}, trying TIER 2…`);
    }
  }

  // TIER 2: NSRDB (2km precision — fallback)
  if (preference === "auto" || preference === "nsrdb") {
    const nsrdbResult = await tryNsrdbLookup(lat, lon, versionId || undefined);
    if (nsrdbResult) {
      console.log(`[IrradianceProvider] ✅ TIER 2 NSRDB: ${nsrdbResult.annual_average.toFixed(2)} kWh/m²/day`);
      return nsrdbResult;
    }
    console.warn(`[IrradianceProvider] ⚠️ TIER 2 NSRDB also failed`);
  }

  if (!versionId) {
    throw new Error(
      `No active irradiance version for dataset '${config.dataset_code}'. Import data via the meteorology admin page.`
    );
  }

  // Final attempt with local grid (will throw descriptive error if no data)
  return tryLocalGrid(lat, lon, config, versionId, versionTag);
}

/**
 * Build an irradiance audit snapshot for embedding in proposals.
 */
export function buildIrradianceAuditPayload(result: IrradianceLookupResult) {
  return {
    irradiance_dataset_code: result.dataset_code,
    irradiance_version_id: result.version_id,
    irradiance_version_tag: result.version_tag,
    irradiance_lookup_method: result.method,
    irradiance_lat: result.point_lat,
    irradiance_lon: result.point_lon,
    irradiance_distance_km: result.distance_km,
    irradiance_series: result.series,
    irradiance_dhi_series: result.dhi_series,
    irradiance_annual_avg: result.annual_average,
    irradiance_unit: result.unit,
    irradiance_cache_hit: result.cache_hit,
    irradiance_resolved_at: result.resolved_at,
    irradiance_has_dhi: result.has_dhi,
    irradiance_source: result.source,
    irradiance_source_tier: result.source_tier,
  };
}
