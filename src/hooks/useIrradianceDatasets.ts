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
}

export interface CacheStats {
  version_id: string;
  count: number;
}

/** Per-version integrity stats */
export interface VersionIntegrity {
  actual_points: number;
  min_lat: number | null;
  max_lat: number | null;
  min_lon: number | null;
  max_lon: number | null;
  has_dhi: boolean;
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

      // Load integrity stats per version via direct query
      if (verRes.data && verRes.data.length > 0) {
        const integrityMap = new Map<string, VersionIntegrity>();

        for (const v of verRes.data as any[]) {
          try {
            // Fetch basic stats: count, bounds, DHI availability
            const { data: points, count } = await supabase
              .from("irradiance_points_monthly")
              .select("lat, lon, dhi_m01", { count: "exact", head: false })
              .eq("version_id", v.id)
              .order("lat", { ascending: true })
              .limit(1);

            const { data: maxPoint } = await supabase
              .from("irradiance_points_monthly")
              .select("lat, lon")
              .eq("version_id", v.id)
              .order("lat", { ascending: false })
              .limit(1);

            const { data: lonBounds } = await supabase
              .from("irradiance_points_monthly")
              .select("lon")
              .eq("version_id", v.id)
              .order("lon", { ascending: true })
              .limit(1);

            const { data: lonMax } = await supabase
              .from("irradiance_points_monthly")
              .select("lon")
              .eq("version_id", v.id)
              .order("lon", { ascending: false })
              .limit(1);

            // Check if any point has DHI data
            const { count: dhiCount } = await supabase
              .from("irradiance_points_monthly")
              .select("id", { count: "exact", head: true })
              .eq("version_id", v.id)
              .not("dhi_m01", "is", null)
              .limit(1);

            integrityMap.set(v.id, {
              actual_points: count ?? 0,
              min_lat: points?.[0]?.lat ?? null,
              max_lat: maxPoint?.[0]?.lat ?? null,
              min_lon: lonBounds?.[0]?.lon ?? null,
              max_lon: lonMax?.[0]?.lon ?? null,
              has_dhi: (dhiCount ?? 0) > 0,
            });
          } catch {
            // Ignore per-version errors
          }
        }

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
