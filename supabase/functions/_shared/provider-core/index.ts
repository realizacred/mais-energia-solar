/**
 * Provider Core — Main barrel export.
 * Import everything from here: import { ... } from "../_shared/provider-core/index.ts";
 */

// Types
export type {
  ProviderErrorCategory,
  ProviderError,
  NormalizedPlant,
  NormalizedDevice,
  NormalizedDeviceGroup,
  NormalizedAlarm,
  DailyMetrics,
  AuthResult,
  ProviderAdapter,
  HttpClientConfig,
  HealthCheckResult,
} from "./types.ts";

// HTTP Client
export { ProviderHttpClient, createProviderClient } from "./http-client.ts";

// Error Normalizer
export { normalizeError } from "./error-normalizer.ts";

// Crypto
export { sha256Hex, md5Hex, md5Base64, hmacSha1Base64, growattMd5, hoymilesPasswordEncode } from "./crypto-helpers.ts";

// Health Check
export { runHealthCheck } from "./health-check.ts";
