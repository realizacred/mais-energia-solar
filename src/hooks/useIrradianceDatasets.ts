import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface IrradianceDataset {
  id: string;
  code: string;
  name: string;
  provider: string;
  resolution_km: number | null;
  default_unit: string;
  description: string | null;
  coverage: any;
  created_at: string;
}

export interface IrradianceVersion {
  id: string;
  dataset_id: string;
  version_tag: string;
  source_note: string | null;
  ingested_at: string;
  checksum_sha256: string | null;
  row_count: number;
  status: string;
  metadata: any;
  created_at: string;
  updated_at?: string;
}

export interface VersionIntegrity {
  actual_points: number;
  min_lat: number | null;
  max_lat: number | null;
  min_lon: number | null;
  max_lon: number | null;
  has_dhi: boolean;
}

/**
 * Calculates expected total grid points from version metadata.
 * Returns null if metadata doesn't contain grid info.
 */
export function getExpectedPoints(version: IrradianceVersion): number | null {
  const meta = version.metadata as Record<string, any> | null;
  if (!meta) return null;

  const step = meta.step_deg ?? 1;
  const bounds = meta.grid_bounds ?? { latMin: -33.5, latMax: 5.5, lonMin: -74.0, lonMax: -35.0 };
  
  const latSteps = Math.floor((bounds.latMax - bounds.latMin) / step) + 1;
  const lonSteps = Math.floor((bounds.lonMax - bounds.lonMin) / step) + 1;
  return latSteps * lonSteps;
}

/**
 * Detects if a processing version is stalled (no update in 10+ minutes).
 */
export function isVersionStalled(version: IrradianceVersion): boolean {
  if (version.status !== "processing") return false;
  const updatedAt = version.updated_at ?? version.created_at;
  const elapsed = Date.now() - new Date(updatedAt).getTime();
  return elapsed > 10 * 60 * 1000; // 10 minutes
}

export function useIrradianceDatasets() {
  const [datasets, setDatasets] = useState<IrradianceDataset[]>([]);
  const [versions, setVersions] = useState<IrradianceVersion[]>([]);
  const [integrity, setIntegrity] = useState<Map<string, VersionIntegrity>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dsRes, verRes] = await Promise.all([
        supabase.from("irradiance_datasets").select("*").order("name"),
        supabase.from("irradiance_dataset_versions").select("*").order("ingested_at", { ascending: false }),
      ]);

      if (dsRes.data) setDatasets(dsRes.data as any[]);
      if (verRes.data) setVersions(verRes.data as any[]);

      // Load integrity stats — single query per version using count + range
      if (verRes.data && verRes.data.length > 0) {
        const integrityMap = new Map<string, VersionIntegrity>();

        // Fetch all stats in parallel (one call per version, but fast)
        await Promise.all(
          (verRes.data as any[]).map(async (v) => {
            try {
              const [countRes, boundsRes, dhiRes] = await Promise.all([
                // Count
                supabase
                  .from("irradiance_points_monthly")
                  .select("id", { count: "exact", head: true })
                  .eq("version_id", v.id),
                // Lat/Lon bounds in one query (min/max via order+limit)
                Promise.all([
                  supabase.from("irradiance_points_monthly").select("lat, lon").eq("version_id", v.id).order("lat", { ascending: true }).limit(1),
                  supabase.from("irradiance_points_monthly").select("lat, lon").eq("version_id", v.id).order("lat", { ascending: false }).limit(1),
                  supabase.from("irradiance_points_monthly").select("lon").eq("version_id", v.id).order("lon", { ascending: true }).limit(1),
                  supabase.from("irradiance_points_monthly").select("lon").eq("version_id", v.id).order("lon", { ascending: false }).limit(1),
                ]),
                // DHI check
                supabase.from("irradiance_points_monthly").select("id", { count: "exact", head: true }).eq("version_id", v.id).not("dhi_m01", "is", null).limit(1),
              ]);

              const [minLatRes, maxLatRes, minLonRes, maxLonRes] = boundsRes;

              integrityMap.set(v.id, {
                actual_points: countRes.count ?? 0,
                min_lat: minLatRes.data?.[0]?.lat ?? null,
                max_lat: maxLatRes.data?.[0]?.lat ?? null,
                min_lon: minLonRes.data?.[0]?.lon ?? null,
                max_lon: maxLonRes.data?.[0]?.lon ?? null,
                has_dhi: (dhiRes.count ?? 0) > 0,
              });
            } catch {
              // Skip version on error
            }
          })
        );

        setIntegrity(integrityMap);
      }
    } catch (e) {
      console.error("Failed to load irradiance datasets:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getVersionsForDataset = (datasetId: string) =>
    versions.filter((v) => v.dataset_id === datasetId);

  const getActiveVersion = (datasetId: string) =>
    versions.find((v) => v.dataset_id === datasetId && v.status === "active");

  const getIntegrity = (versionId: string) =>
    integrity.get(versionId) ?? null;

  return { datasets, versions, loading, reload: load, getVersionsForDataset, getActiveVersion, getIntegrity };
}
