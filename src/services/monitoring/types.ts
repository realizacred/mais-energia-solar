/** Canonical types for the Solar Monitoring module */

export type MonitoringProvider = string; // flexible for multi-provider

export type IntegrationStatus = "disconnected" | "connected" | "connected_pending" | "error";

export type PlantStatus = "normal" | "offline" | "alarm" | "no_communication" | "unknown";

export interface MonitoringIntegration {
  id: string;
  tenant_id: string;
  provider: string;
  status: IntegrationStatus;
  credentials: Record<string, unknown>;
  tokens: Record<string, unknown>;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolarPlant {
  id: string;
  tenant_id: string;
  integration_id: string;
  provider: string;
  external_id: string;
  name: string | null;
  capacity_kw: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: PlantStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SolarPlantMetricsDaily {
  id: string;
  tenant_id: string;
  plant_id: string;
  date: string;
  energy_kwh: number | null;
  power_kw: number | null;
  total_energy_kwh: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
