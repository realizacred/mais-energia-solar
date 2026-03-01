/**
 * Provider Adapter Contract — all adapters must implement this interface.
 * SSOT for the monitoring integration hub.
 */

export interface AdapterPlant {
  provider_plant_id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  installed_power_kwp?: number | null;
  metadata?: Record<string, unknown>;
}

export interface AdapterHealth {
  provider_plant_id: string;
  status: "online" | "alert" | "offline" | "unknown";
  last_seen_at: string | null;
  energy_today_kwh: number;
  energy_month_kwh: number;
  performance_7d_pct?: number | null;
  open_alerts_count: number;
}

export interface AdapterEvent {
  provider_event_id: string;
  provider_plant_id: string;
  severity: "info" | "warn" | "critical";
  type: "offline" | "low_generation" | "comm_fault" | "inverter_fault" | "other";
  title: string;
  message?: string | null;
  starts_at: string;
  ends_at?: string | null;
  is_open: boolean;
}

export interface AdapterReading {
  provider_plant_id: string;
  date: string; // YYYY-MM-DD
  energy_kwh: number;
  peak_power_kw?: number | null;
}

export interface AdapterCredentials {
  [key: string]: string | undefined;
}

export interface AdapterConfig {
  provider_id: string;
  tenant_id: string;
  credentials: AdapterCredentials;
  base_url?: string;
  meta?: Record<string, unknown>;
}

/**
 * Provider Adapter Interface — contract for ALL providers.
 */
export interface IProviderAdapter {
  readonly providerId: string;

  /** Test credentials / connectivity */
  testConnection(config: AdapterConfig): Promise<{ ok: boolean; error?: string }>;

  /** List all plants accessible with these credentials */
  listPlants(config: AdapterConfig): Promise<AdapterPlant[]>;

  /** Get current health/status for all plants */
  getHealth(config: AdapterConfig): Promise<AdapterHealth[]>;

  /** List events/alerts since a given timestamp */
  listEvents(config: AdapterConfig, since?: string): Promise<AdapterEvent[]>;

  /** Get daily energy readings for a date range */
  getDailyReadings(config: AdapterConfig, dateFrom: string, dateTo: string): Promise<AdapterReading[]>;
}

/**
 * Base adapter with sensible defaults for stubs.
 * Extend this and override methods as you implement each provider.
 */
export abstract class BaseAdapter implements IProviderAdapter {
  abstract readonly providerId: string;

  async testConnection(_config: AdapterConfig): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: "Adapter not yet implemented" };
  }

  async listPlants(_config: AdapterConfig): Promise<AdapterPlant[]> {
    return [];
  }

  async getHealth(_config: AdapterConfig): Promise<AdapterHealth[]> {
    return [];
  }

  async listEvents(_config: AdapterConfig, _since?: string): Promise<AdapterEvent[]> {
    return [];
  }

  async getDailyReadings(_config: AdapterConfig, _dateFrom: string, _dateTo: string): Promise<AdapterReading[]> {
    return [];
  }
}
