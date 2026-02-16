/**
 * Shared types for the Base Meteorológica admin module.
 */

export interface VersionRow {
  id: string;
  dataset_id: string;
  version_tag: string;
  status: string;
  row_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  checksum_sha256?: string;
}

export interface DatasetRow {
  id: string;
  code: string;
  name: string;
}

export interface DatasetConfig {
  code: string;
  label: string;
  type: "csv" | "api";
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export const BRASILIA = { lat: -15.7942, lon: -47.8822 } as const;
