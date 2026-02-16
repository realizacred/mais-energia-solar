/**
 * IrradianceProvider — Canonical irradiance lookup service.
 *
 * Dual-source strategy:
 *   PRIMARY: NSRDB/NREL API (2km resolution, ±3-5% error)
 *   FALLBACK: NASA POWER stored grid (nearest-point lookup)
 *
 * Fluxo:
 *   1. Resolve config do tenant (dataset_code + version_id + method)
 *   2. Try NSRDB API via edge function (high precision)
 *   3. If NSRDB fails → fallback to stored NASA POWER data
 *   4. Persist cache + return with source attribution
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
  /** Data source: 'nsrdb' | 'nasa_power' | 'cache' */
  source: string;
}

export interface IrradianceLookupInput {
  lat: number;
  lon: number;
  tenant_id?: string;
  dataset_code_override?: string;
  version_id_override?: string;
  /** Force specific source: 'nsrdb' | 'nasa' | 'auto' (default: auto) */
  source_preference?: "nsrdb" | "nasa" | "auto";
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
  const hasData = Object.values(dhi).some(v => v > 0);
  return hasData ? dhi : null;
}

function buildDhiFromRecord(rec: Record<string, number>): DhiSeries | null {
  const dhi: DhiSeries = {
    dhi_m01: rec.dhi_m01 ?? 0, dhi_m02: rec.dhi_m02 ?? 0,
    dhi_m03: rec.dhi_m03 ?? 0, dhi_m04: rec.dhi_m04 ?? 0,
    dhi_m05: rec.dhi_m05 ?? 0, dhi_m06: rec.dhi_m06 ?? 0,
    dhi_m07: rec.dhi_m07 ?? 0, dhi_m08: rec.dhi_m08 ?? 0,
    dhi_m09: rec.dhi_m09 ?? 0, dhi_m10: rec.dhi_m10 ?? 0,
    dhi_m11: rec.dhi_m11 ?? 0, dhi_m12: rec.dhi_m12 ?? 0,
  };
  const hasData = Object.values(dhi).some(v => v > 0);
  return hasData ? dhi : null;
}

// ─── NSRDB Lookup (Primary) ────────────────────────────────────

async function tryNsrdbLookup(
  lat: number,
  lon: number,
  versionId?: string
): Promise<IrradianceLookupResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("nsrdb-lookup", {
      body: { lat, lon, version_id: versionId },
    });

    if (error || !data?.success) {
      console.warn("[IrradianceProvider] NSRDB lookup failed:", error?.message || data?.error);
      return null;
    }

    const series: IrradianceSeries = {
      m01: data.series.m01 ?? 0, m02: data.series.m02 ?? 0,
      m03: data.series.m03 ?? 0, m04: data.series.m04 ?? 0,
      m05: data.series.m05 ?? 0, m06: data.series.m06 ?? 0,
      m07: data.series.m07 ?? 0, m08: data.series.m08 ?? 0,
      m09: data.series.m09 ?? 0, m10: data.series.m10 ?? 0,
      m11: data.series.m11 ?? 0, m12: data.series.m12 ?? 0,
    };

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
    };
  } catch (e: any) {
    console.warn("[IrradianceProvider] NSRDB exception:", e.message);
    return null;
  }
}

// ─── NASA POWER Fallback ───────────────────────────────────────

const DEFAULT_DATASET_CODE = "INPE_2017_SUNDATA";

async function nasaPowerFallback(
  lat: number,
  lon: number,
  config: TenantIrradianceConfig,
  versionId: string,
  versionTag: string
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
    const series = cached.series as unknown as IrradianceSeries;
    return {
      series,
      dhi_series: null,
      annual_average: seriesAverage(series),
      dataset_code: config.dataset_code,
      version_tag: versionTag,
      version_id: versionId,
      method: config.lookup_method,
      unit: "kwh_m2_day",
      point_lat: Number(cached.point_lat),
      point_lon: Number(cached.point_lon),
      distance_km: Number(cached.distance_km),
      cache_hit: true,
      resolved_at: new Date().toISOString(),
      has_dhi: false,
      source: "nasa_power",
    };
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
    source: "nasa_power",
  };
}

// ─── Main Provider (Dual Strategy) ─────────────────────────────

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

  // 2. Resolve active version (for NASA fallback)
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

  // 3. DUAL STRATEGY: NSRDB primary → NASA fallback
  if (preference !== "nasa") {
    const nsrdbResult = await tryNsrdbLookup(lat, lon, versionId || undefined);
    if (nsrdbResult) {
      console.log(`[IrradianceProvider] NSRDB success: ${nsrdbResult.annual_average.toFixed(2)} kWh/m²/day`);
      return nsrdbResult;
    }
    console.warn(`[IrradianceProvider] NSRDB failed, falling back to NASA POWER`);
  }

  // 4. NASA POWER fallback
  if (!versionId) {
    throw new Error(`No active irradiance version for dataset '${config.dataset_code}' and NSRDB unavailable`);
  }

  return nasaPowerFallback(lat, lon, config, versionId, versionTag);
}

/**
 * Build an irradiance audit snapshot for embedding in proposals.
 * Ensures reproducibility and compliance.
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
  };
}
