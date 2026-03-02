/** Types for MPPT / String monitoring subsystem */

export type StringGranularity = "string" | "mppt" | "inverter";

export type StringAlertType = "string_stopped" | "string_low" | "mppt_stopped" | "mppt_low";
export type StringAlertStatus = "open" | "resolved";

/** Canonical normalized reading — provider-agnostic */
export interface NormalizedStringReading {
  tenant_id: string;
  plant_id: string;
  device_id: string;
  inverter_serial: string | null;
  provider_id: string | null;
  ts: string;
  inverter_online: boolean;
  plant_generating: boolean;
  mppt_number: number | null;
  string_number: number | null;
  power_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  granularity: StringGranularity;
}

export interface StringRegistry {
  id: string;
  tenant_id: string;
  plant_id: string;
  device_id: string;
  inverter_serial: string | null;
  provider_id: string | null;
  mppt_number: number | null;
  string_number: number | null;
  granularity: StringGranularity;
  first_seen_at: string;
  last_seen_at: string;
  baseline_day: string | null;
  baseline_power_p50_w: number | null;
  baseline_power_avg_w: number | null;
  baseline_power_p90_w: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StringMetric {
  id: string;
  tenant_id: string;
  registry_id: string;
  plant_id: string;
  device_id: string;
  ts: string;
  power_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  online: boolean;
  generating: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StringAlert {
  id: string;
  tenant_id: string;
  plant_id: string;
  device_id: string;
  registry_id: string | null;
  alert_type: StringAlertType;
  severity: string;
  status: StringAlertStatus;
  detected_at: string;
  resolved_at: string | null;
  message: string | null;
  context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Enriched registry entry with latest metric snapshot */
export interface StringRegistryWithMetric extends StringRegistry {
  latest_power_w?: number | null;
  latest_voltage_v?: number | null;
  latest_current_a?: number | null;
  latest_ts?: string | null;
  baseline_pct?: number | null;
  alert_status?: "ok" | "warn" | "critical" | "unknown";
}

/** Device card data for the MPPT/Strings UI */
export interface DeviceStringCard {
  device_id: string;
  device_model: string | null;
  device_serial: string | null;
  device_status: string;
  strings: StringRegistryWithMetric[];
  open_alerts: StringAlert[];
}
