/**
 * Canonical HTTP client for provider adapters.
 * Handles: timeout, retry (429/5xx), exponential backoff, circuit breaker.
 */

interface HttpClientOptions {
  timeout?: number;       // ms, default 15000
  maxRetries?: number;    // default 3
  backoffBase?: number;   // ms, default 1000
  backoffMax?: number;    // ms, default 30000
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;

function getCircuit(providerId: string): CircuitState {
  if (!circuits.has(providerId)) {
    circuits.set(providerId, { failures: 0, lastFailure: 0, isOpen: false });
  }
  return circuits.get(providerId)!;
}

function recordSuccess(providerId: string) {
  const c = getCircuit(providerId);
  c.failures = 0;
  c.isOpen = false;
}

function recordFailure(providerId: string) {
  const c = getCircuit(providerId);
  c.failures++;
  c.lastFailure = Date.now();
  if (c.failures >= CIRCUIT_THRESHOLD) {
    c.isOpen = true;
  }
}

function isCircuitOpen(providerId: string): boolean {
  const c = getCircuit(providerId);
  if (!c.isOpen) return false;
  if (Date.now() - c.lastFailure > CIRCUIT_RESET_MS) {
    c.isOpen = false;
    c.failures = 0;
    return false;
  }
  return true;
}

export async function providerFetch(
  providerId: string,
  url: string,
  init?: RequestInit,
  options?: HttpClientOptions,
): Promise<Response> {
  if (isCircuitOpen(providerId)) {
    throw new Error(`Circuit breaker open for ${providerId}. Retry later.`);
  }

  const timeout = options?.timeout ?? 15000;
  const maxRetries = options?.maxRetries ?? 3;
  const backoffBase = options?.backoffBase ?? 1000;
  const backoffMax = options?.backoffMax ?? 30000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP ${response.status} from ${providerId}`);
      }

      recordSuccess(providerId);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      recordFailure(providerId);

      if (attempt < maxRetries) {
        const delay = Math.min(backoffBase * Math.pow(2, attempt), backoffMax);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} retries for ${providerId}`);
}
