/**
 * IrradianceProvider — Canonical irradiance lookup service.
 *
 * Runtime SEM dependência externa. Consulta apenas a base interna (DB + cache).
 * Retorna série mensal (12 meses) + metadados para auditoria.
 *
 * Fluxo:
 *   1. Resolve config do tenant (dataset_code + version_id + method)
 *   2. Resolve version_id ativa se não especificada
 *   3. Cache check (lat/lon arredondado 4 casas)
 *   4. Nearest-point lookup via RPC (Haversine)
 *   5. Persist cache + return
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────

export interface IrradianceSeries {
  m01: number; m02: number; m03: number; m04: number;
  m05: number; m06: number; m07: number; m08: number;
  m09: number; m10: number; m11: number; m12: number;
}

export interface IrradianceLookupResult {
  series: IrradianceSeries;
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
}

export interface IrradianceLookupInput {
  lat: number;
  lon: number;
  tenant_id?: string; // if omitted, uses default dataset
  dataset_code_override?: string;
  version_id_override?: string;
}

interface TenantIrradianceConfig {
  dataset_code: string;
  version_id: string | null;
  lookup_method: string;
}

interface DatasetVersion {
  id: string;
  version_tag: string;
  dataset_id: string;
  status: string;
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

// ─── Provider ───────────────────────────────────────────────────

const DEFAULT_DATASET_CODE = "INPE_2017_SUNDATA";

export async function getMonthlyIrradiance(
  input: IrradianceLookupInput
): Promise<IrradianceLookupResult> {
  const { lat, lon } = input;

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
  let versionId = config.version_id;
  let versionTag = "";

  if (!versionId) {
    const { data: ds } = await supabase
      .from("irradiance_datasets")
      .select("id")
      .eq("code", config.dataset_code)
      .single();

    if (!ds) throw new Error(`Dataset '${config.dataset_code}' not found`);

    const { data: ver } = await supabase
      .from("irradiance_dataset_versions")
      .select("id, version_tag")
      .eq("dataset_id", ds.id)
      .eq("status", "active")
      .order("ingested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ver) throw new Error(`No active version for dataset '${config.dataset_code}'`);

    versionId = ver.id;
    versionTag = ver.version_tag;
  } else {
    const { data: ver } = await supabase
      .from("irradiance_dataset_versions")
      .select("version_tag")
      .eq("id", versionId)
      .single();
    versionTag = ver?.version_tag || "unknown";
  }

  // 3. Check cache
  const latR = roundCoord(lat);
  const lonR = roundCoord(lon);

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
      annual_average: seriesAverage(series),
      dataset_code: config.dataset_code,
      version_tag: versionTag,
      version_id: versionId!,
      method: config.lookup_method,
      unit: "kwh_m2_day",
      point_lat: Number(cached.point_lat),
      point_lon: Number(cached.point_lon),
      distance_km: Number(cached.distance_km),
      cache_hit: true,
      resolved_at: new Date().toISOString(),
    };
  }

  // 4. Nearest-point lookup via RPC
  const { data: points, error } = await supabase.rpc("irradiance_nearest_point", {
    p_version_id: versionId!,
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

  // 5. Persist cache (fire-and-forget)
  supabase
    .from("irradiance_lookup_cache")
    .upsert({
      version_id: versionId!,
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
    annual_average: seriesAverage(series),
    dataset_code: config.dataset_code,
    version_tag: versionTag,
    version_id: versionId!,
    method: config.lookup_method,
    unit: pt.unit || "kwh_m2_day",
    point_lat: Number(pt.lat),
    point_lon: Number(pt.lon),
    distance_km: Number(pt.distance_km),
    cache_hit: false,
    resolved_at: new Date().toISOString(),
  };
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
    irradiance_annual_avg: result.annual_average,
    irradiance_unit: result.unit,
    irradiance_cache_hit: result.cache_hit,
    irradiance_resolved_at: result.resolved_at,
  };
}
