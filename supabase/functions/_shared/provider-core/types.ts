/**
 * Integration Core — Canonical types for ALL monitoring providers.
 * SSOT: Every provider adapter MUST use these interfaces.
 */

// ─── Error Categories ────────────────────────────────────
export type ProviderErrorCategory =
  | "AUTH"          // Invalid/expired credentials
  | "RATE_LIMIT"    // Provider rate limit exceeded
  | "TIMEOUT"       // Request timed out
  | "NOT_FOUND"     // Resource not found (plant, device, etc.)
  | "PERMISSION"    // Authenticated but insufficient permissions
  | "PARSE"         // Response could not be parsed
  | "PROVIDER_DOWN" // Provider API unreachable
  | "UNKNOWN";      // Unclassified

export interface ProviderError {
  category: ProviderErrorCategory;
  provider: string;
  statusCode: number | null;
  providerErrorCode: string | null;
  message: string;
  requestId?: string;
  retryable: boolean;
}

// ─── Normalized Data Contracts ───────────────────────────
export interface NormalizedPlant {
  external_id: string;
  name: string;
  capacity_kw: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string; // "normal" | "offline" | "alarm" | "unknown"
  metadata: Record<string, unknown>;
}

export interface NormalizedDevice {
  provider_device_id: string;
  type: string;       // "inverter" | "logger" | "gateway" | "meter"
  model: string | null;
  serial: string | null;
  status: string;
  metadata: Record<string, unknown>;
}

export interface NormalizedDeviceGroup {
  stationId: string;
  devices: NormalizedDevice[];
}

export interface NormalizedAlarm {
  provider_event_id: string;
  provider_plant_id: string;
  provider_device_id: string | null;
  severity: "info" | "warn" | "critical";
  type: string;
  title: string;
  message: string | null;
  starts_at: string;
  ends_at: string | null;
  is_open: boolean;
}

export interface DailyMetrics {
  power_kw: number | null;
  energy_kwh: number | null;
  total_energy_kwh: number | null;
  metadata: Record<string, unknown>;
}

// ─── Auth Result ─────────────────────────────────────────
export interface AuthResult {
  credentials: Record<string, unknown>;  // safe to persist
  tokens: Record<string, unknown>;       // tokens / session data
}

// ─── Provider Adapter Interface ──────────────────────────
export interface ProviderAdapter {
  readonly providerId: string;

  /** Validate credential fields before attempting auth */
  validateCredentials(creds: Record<string, string>): void;

  /** Authenticate and return tokens */
  authenticate(creds: Record<string, string>): Promise<AuthResult>;

  /** Refresh expired tokens (optional — some providers have non-expiring keys) */
  refreshToken?(tokens: Record<string, unknown>, credentials: Record<string, unknown>): Promise<AuthResult>;

  /** List all plants/sites */
  fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]>;

  /** Fetch daily metrics for one plant */
  fetchMetrics(auth: AuthResult, externalPlantId: string): Promise<DailyMetrics>;

  /** List devices per plant (optional) */
  fetchDevices?(auth: AuthResult): Promise<NormalizedDeviceGroup[]>;

  /** List alarms (optional) */
  fetchAlarms?(auth: AuthResult): Promise<NormalizedAlarm[]>;
}

// ─── HTTP Client Config ──────────────────────────────────
export interface HttpClientConfig {
  /** Base URL for the provider API */
  baseUrl: string;
  /** Default timeout in ms (default: 15000) */
  timeoutMs?: number;
  /** Max retries on retryable errors (default: 2) */
  maxRetries?: number;
  /** Default headers applied to every request */
  defaultHeaders?: Record<string, string>;
  /** Provider name for logging */
  provider: string;
}

// ─── Health Check Result ─────────────────────────────────
export interface HealthCheckResult {
  provider: string;
  status: "OK" | "FAIL" | "DEGRADED";
  authOk: boolean;
  endpointOk: boolean;
  latencyMs: number;
  error?: string;
  checkedAt: string;
}
