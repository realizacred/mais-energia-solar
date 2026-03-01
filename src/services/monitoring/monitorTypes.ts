/** Types for the new monitor_* schema */

export type MonitorPlantStatus = "online" | "alert" | "offline" | "unknown";
export type AlertSeverity = "info" | "warn" | "critical";
export type AlertType = "offline" | "low_generation" | "comm_fault" | "inverter_fault" | "other";
export type DeviceType = "inverter" | "logger" | "gateway" | "meter";

export interface MonitorPlant {
  id: string;
  tenant_id: string;
  client_id: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  installed_power_kwp: number | null;
  provider_id: string | null;
  provider_plant_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MonitorDevice {
  id: string;
  tenant_id: string;
  plant_id: string;
  provider_device_id: string | null;
  type: string;
  model: string | null;
  serial: string | null;
  last_seen_at: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MonitorHealthCache {
  id: string;
  tenant_id: string;
  plant_id: string;
  status: MonitorPlantStatus;
  last_seen_at: string | null;
  energy_today_kwh: number;
  energy_month_kwh: number;
  performance_7d_pct: number | null;
  open_alerts_count: number;
  updated_at: string;
}

export interface MonitorEvent {
  id: string;
  tenant_id: string;
  plant_id: string;
  device_id: string | null;
  provider_event_id: string | null;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string | null;
  starts_at: string;
  ends_at: string | null;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitorReadingDaily {
  id: string;
  tenant_id: string;
  plant_id: string;
  date: string;
  energy_kwh: number;
  peak_power_kw: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Enriched plant with health data for list/map */
export interface PlantWithHealth extends MonitorPlant {
  health?: MonitorHealthCache;
}

/** Dashboard aggregated stats */
export interface MonitorDashboardStats {
  plants_online: number;
  plants_alert: number;
  plants_offline: number;
  plants_unknown: number;
  total_plants: number;
  energy_today_kwh: number;
  energy_month_kwh: number;
}
