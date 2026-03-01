/**
 * ProviderHttpClient — Single SSOT HTTP client for ALL provider API calls.
 * Handles: timeout, retry with exponential backoff, rate limit awareness,
 * safe JSON parsing, structured logging (no secret leaks).
 */
import type { HttpClientConfig, ProviderError, ProviderErrorCategory } from "./types.ts";

const SENSITIVE_KEYS = /token|secret|password|apikey|api_key|authorization|cookie/i;

/** Mask sensitive values in objects for logging */
function maskSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.test(k) && typeof v === "string") {
      masked[k] = v.length > 8 ? `${v.slice(0, 4)}****${v.slice(-4)}` : "****";
    } else {
      masked[k] = v;
    }
  }
  return masked;
}

/** Mask a URL's query params that look sensitive */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of u.searchParams.keys()) {
      if (SENSITIVE_KEYS.test(key)) {
        const val = u.searchParams.get(key) || "";
        u.searchParams.set(key, val.length > 8 ? `${val.slice(0, 4)}****` : "****");
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}

export class ProviderHttpClient {
  private config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 2,
      defaultHeaders: config.defaultHeaders ?? {},
      provider: config.provider,
    };
  }

  /** Update base URL (for region discovery, etc.) */
  setBaseUrl(url: string) {
    this.config.baseUrl = url;
  }

  /**
   * Core request method with retry, timeout, and error normalization.
   */
  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      /** Override base URL for this single request */
      absoluteUrl?: string;
      /** Content type (default: application/json) */
      contentType?: string;
      /** Custom timeout for this request */
      timeoutMs?: number;
      /** Skip retry even on retryable errors */
      noRetry?: boolean;
    },
  ): Promise<T> {
    const url = options?.absoluteUrl || `${this.config.baseUrl}${path}`;
    const contentType = options?.contentType ?? "application/json";
    const headers: Record<string, string> = {
      ...this.config.defaultHeaders,
      ...options?.headers,
    };

    // Only set Content-Type for requests with body
    if (method !== "GET" && options?.body != null) {
      headers["Content-Type"] = contentType;
    }

    let serializedBody: string | undefined;
    if (options?.body != null) {
      serializedBody = contentType.includes("json")
        ? JSON.stringify(options.body)
        : String(options.body);
    }

    const maxAttempts = options?.noRetry ? 1 : this.config.maxRetries + 1;
    let lastError: ProviderError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          options?.timeoutMs ?? this.config.timeoutMs,
        );

        const t0 = performance.now();

        const res = await fetch(url, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const latency = Math.round(performance.now() - t0);
        console.log(
          `[${this.config.provider}] ${method} ${maskUrl(url)} → ${res.status} (${latency}ms, attempt ${attempt})`,
        );

        // Rate limit → retryable
        if (res.status === 429) {
          lastError = this.createError("RATE_LIMIT", res.status, null, "Rate limit exceeded", true);
          if (attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw lastError;
        }

        // Server error → retryable
        if (res.status >= 500) {
          const text = await res.text().catch(() => "");
          lastError = this.createError("PROVIDER_DOWN", res.status, null, `Server error: ${text.slice(0, 200)}`, true);
          if (attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw lastError;
        }

        // Auth errors → NOT retryable
        if (res.status === 401 || res.status === 403) {
          const text = await res.text().catch(() => "");
          throw this.createError("AUTH", res.status, null, `Auth failed (${res.status}): ${text.slice(0, 200)}`, false);
        }

        // 404
        if (res.status === 404) {
          throw this.createError("NOT_FOUND", 404, null, `Not found: ${path}`, false);
        }

        // Any other 4xx → non-retryable client error
        if (res.status >= 400 && res.status < 500) {
          const text = await res.text().catch(() => "");
          throw this.createError("UNKNOWN", res.status, null, `Client error ${res.status}: ${text.slice(0, 200)}`, false);
        }

        // Parse response
        const responseText = await res.text();
        if (!responseText.trim()) {
          return {} as T;
        }

        try {
          return JSON.parse(responseText) as T;
        } catch {
          // Some providers return HTML on error
          if (responseText.trim().startsWith("<")) {
            throw this.createError("PARSE", res.status, null, `HTML response (likely auth redirect): ${responseText.slice(0, 100)}`, false);
          }
          throw this.createError("PARSE", res.status, null, `Invalid JSON: ${responseText.slice(0, 200)}`, false);
        }
      } catch (err) {
        if ((err as ProviderError).category) {
          lastError = err as ProviderError;
          if (!lastError.retryable || attempt >= maxAttempts) throw lastError;
          await this.backoff(attempt);
          continue;
        }

        // AbortError = timeout
        if ((err as Error).name === "AbortError") {
          lastError = this.createError("TIMEOUT", null, null, `Request timed out after ${this.config.timeoutMs}ms`, true);
          if (attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw lastError;
        }

        // Network error
        const msg = (err as Error).message || "Unknown error";
        if (/fetch|network|dns|connect/i.test(msg)) {
          lastError = this.createError("PROVIDER_DOWN", null, null, msg, true);
          if (attempt < maxAttempts) {
            await this.backoff(attempt);
            continue;
          }
          throw lastError;
        }

        throw this.createError("UNKNOWN", null, null, msg, false);
      }
    }

    throw lastError || this.createError("UNKNOWN", null, null, "All retries exhausted", false);
  }

  /** Convenience: GET */
  get<T = unknown>(path: string, options?: Parameters<ProviderHttpClient["request"]>[2]) {
    return this.request<T>("GET", path, options);
  }

  /** Convenience: POST */
  post<T = unknown>(path: string, body?: unknown, options?: Omit<Parameters<ProviderHttpClient["request"]>[2], "body">) {
    return this.request<T>("POST", path, { ...options, body });
  }

  // ─── Internal ──────────────────────────────────────────
  private createError(
    category: ProviderErrorCategory,
    statusCode: number | null,
    providerErrorCode: string | null,
    message: string,
    retryable: boolean,
  ): ProviderError {
    return { category, provider: this.config.provider, statusCode, providerErrorCode, message, retryable };
  }

  private backoff(attempt: number): Promise<void> {
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000) + Math.random() * 500;
    console.log(`[${this.config.provider}] Retry backoff: ${Math.round(delay)}ms`);
    return new Promise((r) => setTimeout(r, delay));
  }
}

/** Create a standard http client for a provider */
export function createProviderClient(provider: string, baseUrl: string, extraHeaders?: Record<string, string>): ProviderHttpClient {
  return new ProviderHttpClient({
    provider,
    baseUrl,
    defaultHeaders: extraHeaders,
  });
}
