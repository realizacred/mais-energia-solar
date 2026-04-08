/**
 * Shared error handling utilities for Edge Functions.
 * Provides: retry with exponential backoff, circuit breaker, fetch with timeout.
 */

// ── Retry with exponential backoff ──────────────────────────

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry. Return false to abort. */
  onRetry?: (attempt: number, error: unknown) => boolean | void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 16000, onRetry } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxRetries) break;

      if (onRetry) {
        const shouldContinue = onRetry(attempt + 1, err);
        if (shouldContinue === false) break;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  throw lastError;
}

// ── Fetch with timeout ──────────────────────────────────────

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`Timeout após ${timeoutMs}ms ao acessar ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Circuit Breaker (in-memory per invocation, persisted via DB) ──

export interface CircuitBreakerState {
  failures: number;
  last_failure_at: string | null;
  open_until: string | null;
}

const CIRCUIT_OPEN_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const CIRCUIT_FAILURE_THRESHOLD = 3;

export function isCircuitOpen(state: CircuitBreakerState | null): boolean {
  if (!state?.open_until) return false;
  return new Date(state.open_until).getTime() > Date.now();
}

export function recordFailure(state: CircuitBreakerState | null): CircuitBreakerState {
  const current = state || { failures: 0, last_failure_at: null, open_until: null };
  const failures = current.failures + 1;
  const now = new Date().toISOString();
  return {
    failures,
    last_failure_at: now,
    open_until: failures >= CIRCUIT_FAILURE_THRESHOLD
      ? new Date(Date.now() + CIRCUIT_OPEN_DURATION_MS).toISOString()
      : current.open_until,
  };
}

export function resetCircuit(): CircuitBreakerState {
  return { failures: 0, last_failure_at: null, open_until: null };
}

// ── Sanitized error response ────────────────────────────────

export function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Strip stack traces in production
    return err.message;
  }
  if (typeof err === "string") return err;
  return "Erro interno";
}

// ── Health cache updater ────────────────────────────────────

export async function updateHealthCache(
  supabase: any,
  integrationName: string,
  status: "up" | "degraded" | "down",
  extra: Record<string, unknown> = {},
  tenantId?: string,
) {
  try {
    const row: Record<string, unknown> = {
      integration_name: integrationName,
      status,
      last_check_at: new Date().toISOString(),
      response_time_ms: extra.response_time_ms ?? null,
      error_message: extra.error_message ?? null,
      metadata: extra.metadata ?? null,
    };
    if (tenantId) {
      row.tenant_id = tenantId;
    }
    await supabase
      .from("integration_health_cache")
      .upsert(row, { onConflict: "tenant_id,integration_name" });
  } catch (e) {
    console.warn(`[error-utils] Failed to update health cache for ${integrationName}:`, e);
  }
}
