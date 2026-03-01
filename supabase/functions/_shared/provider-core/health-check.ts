/**
 * Health Check — Validates auth + minimal endpoint for a provider adapter.
 */
import type { ProviderAdapter, AuthResult, HealthCheckResult } from "./types.ts";
import { normalizeError } from "./error-normalizer.ts";

export async function runHealthCheck(
  adapter: ProviderAdapter,
  auth: AuthResult,
): Promise<HealthCheckResult> {
  const t0 = performance.now();
  let authOk = false;
  let endpointOk = false;
  let error: string | undefined;

  try {
    // Test fetchPlants as the minimum viable endpoint
    const plants = await adapter.fetchPlants(auth);
    authOk = true;
    endpointOk = plants.length >= 0; // even 0 plants is OK if no error
  } catch (err) {
    const normalized = normalizeError(err, adapter.providerId);
    authOk = normalized.category !== "AUTH";
    error = `[${normalized.category}] ${normalized.message}`;
  }

  const latencyMs = Math.round(performance.now() - t0);
  const status = authOk && endpointOk ? "OK" : authOk ? "DEGRADED" : "FAIL";

  return {
    provider: adapter.providerId,
    status,
    authOk,
    endpointOk,
    latencyMs,
    error,
    checkedAt: new Date().toISOString(),
  };
}
