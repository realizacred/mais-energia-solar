import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useIrradianceDatasets() {
  const [datasets, setDatasets] = useState<IrradianceDataset[]>([]);
  const [versions, setVersions] = useState<IrradianceVersion[]>([]);
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

  return { datasets, versions, loading, reload: load, getVersionsForDataset, getActiveVersion };
}
