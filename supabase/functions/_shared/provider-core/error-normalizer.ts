/**
 * ErrorNormalizer — Converts any raw error into a standardized ProviderError.
 * SSOT for error classification across ALL providers.
 */
import type { ProviderError, ProviderErrorCategory } from "./types.ts";

// ─── Pattern matchers for auto-classification ────────────
const AUTH_PATTERNS = /unauthorized|unauthenticated|invalid.*(token|key|credential|password|login)|expired|forbidden|wrong sign|not exit|not exist|user does not/i;
const RATE_LIMIT_PATTERNS = /rate.?limit|too many|throttl|429|quota|exceed/i;
const TIMEOUT_PATTERNS = /timeout|timed? out|abort|deadline/i;
const NOT_FOUND_PATTERNS = /not found|404|no data|empty|does not exist/i;
const PERMISSION_PATTERNS = /permission|forbidden|denied|insufficient|privilege/i;
const PARSE_PATTERNS = /json|parse|unexpected token|invalid response|html.*response/i;
const NETWORK_PATTERNS = /fetch|network|dns|connect|econnrefused|enotfound|ssl|tls|socket/i;

/**
 * Classify an arbitrary error into a ProviderError.
 * Supports: Error objects, ProviderError (passthrough), string, Supabase errors, fetch errors.
 */
export function normalizeError(
  error: unknown,
  provider: string,
  context?: { statusCode?: number; providerErrorCode?: string },
): ProviderError {
  // Already normalized
  if (isProviderError(error)) return error;

  const rawMessage = extractMessage(error);
  const statusCode = context?.statusCode ?? extractStatusCode(error);
  const providerCode = context?.providerErrorCode ?? null;

  const category = classifyError(rawMessage, statusCode);

  return {
    category,
    provider,
    statusCode,
    providerErrorCode: providerCode,
    message: rawMessage,
    retryable: isRetryable(category),
  };
}

function isProviderError(e: unknown): e is ProviderError {
  return !!e && typeof e === "object" && "category" in e && "provider" in e;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    return String(obj.message || obj.msg || obj.error || obj.error_msg || "Unknown error");
  }
  return "Unknown error";
}

function extractStatusCode(error: unknown): number | null {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.statusCode === "number") return obj.statusCode;
  }
  return null;
}

function classifyError(message: string, statusCode: number | null): ProviderErrorCategory {
  // Status code takes priority
  if (statusCode === 401 || statusCode === 403) return "AUTH";
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 429) return "RATE_LIMIT";
  if (statusCode && statusCode >= 500) return "PROVIDER_DOWN";

  // Pattern matching
  if (AUTH_PATTERNS.test(message)) return "AUTH";
  if (RATE_LIMIT_PATTERNS.test(message)) return "RATE_LIMIT";
  if (TIMEOUT_PATTERNS.test(message)) return "TIMEOUT";
  if (PERMISSION_PATTERNS.test(message)) return "PERMISSION";
  if (NOT_FOUND_PATTERNS.test(message)) return "NOT_FOUND";
  if (PARSE_PATTERNS.test(message)) return "PARSE";
  if (NETWORK_PATTERNS.test(message)) return "PROVIDER_DOWN";

  return "UNKNOWN";
}

function isRetryable(category: ProviderErrorCategory): boolean {
  return ["RATE_LIMIT", "TIMEOUT", "PROVIDER_DOWN"].includes(category);
}
