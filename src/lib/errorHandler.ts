import { captureError, addBreadcrumb } from "@/lib/sentry";
import { parseInvokeError } from "@/lib/supabaseFunctionError";

// ─── Types ──────────────────────────────────────────────────────
export interface AppError {
  message: string;
  userMessage: string;
  code?: string;
  status?: number;
  context?: Record<string, unknown>;
}

export type ErrorSource = "supabase" | "edge_function" | "fetch" | "unknown";

interface ErrorContext {
  source: ErrorSource;
  action: string; // e.g. "fetch_leads", "create_orcamento"
  entityId?: string;
  userId?: string;
  role?: string;
  route?: string;
  extra?: Record<string, unknown>;
}

// ─── User-facing messages (PT-BR) ──────────────────────────────
const USER_MESSAGES: Record<string, string> = {
  // Auth
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de fazer login.",
  "User already registered": "Este email já está cadastrado.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",

  // RLS / Permissions
  "new row violates row-level security policy": "Você não tem permissão para esta ação.",
  "insufficient_privilege": "Permissão insuficiente.",

  // Rate limit
  "Rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
  "P0429": "Muitas tentativas. Aguarde antes de tentar novamente.",

  // Network
  "Failed to fetch": "Erro de conexão. Verifique sua internet.",
  "NetworkError": "Erro de rede. Verifique sua conexão.",
  "Load failed": "Falha ao carregar. Verifique sua conexão.",

  // Generic
  "PGRST301": "Sessão expirada. Faça login novamente.",
  "JWT expired": "Sessão expirada. Faça login novamente.",
};

// ─── Core handler ───────────────────────────────────────────────

/**
 * Centralizes all error handling: logs, maps to user message, reports to Sentry.
 * Returns a standardized AppError for UI consumption.
 */
export function handleError(error: unknown, ctx: ErrorContext): AppError {
  const rawMessage = extractMessage(error);
  const code = extractCode(error);
  const status = extractStatus(error);

  // Build user-friendly message
  const userMessage = mapToUserMessage(rawMessage, code, status);

  // Build Sentry context
  const sentryContext: Record<string, unknown> = {
    source: ctx.source,
    action: ctx.action,
    code,
    status,
    rawMessage,
    ...ctx.extra,
  };
  if (ctx.entityId) sentryContext.entityId = ctx.entityId;
  if (ctx.userId) sentryContext.userId = ctx.userId;
  if (ctx.role) sentryContext.role = ctx.role;
  if (ctx.route) sentryContext.route = ctx.route;

  // Add breadcrumb for navigation context
  addBreadcrumb(`Error in ${ctx.action}`, ctx.source, sentryContext);

  // Report to Sentry (skips network/auth errors to reduce noise)
  if (!isIgnoredError(rawMessage, code, status)) {
    captureError(error, sentryContext);
  }

  // Console log for dev
  console.error(`[${ctx.source}:${ctx.action}]`, rawMessage, sentryContext);

  return {
    message: rawMessage,
    userMessage,
    code,
    status,
    context: sentryContext,
  };
}

// ─── Specialized handlers ───────────────────────────────────────

/**
 * Handle Supabase client errors (from .from().select() etc.)
 */
export function handleSupabaseError(
  error: unknown,
  action: string,
  extra?: Partial<ErrorContext>
): AppError {
  return handleError(error, {
    source: "supabase",
    action,
    ...extra,
  });
}

/**
 * Handle edge function invoke errors (from supabase.functions.invoke())
 */
export async function handleEdgeFunctionError(
  error: unknown,
  action: string,
  extra?: Partial<ErrorContext>
): Promise<AppError> {
  // Try to parse the invoke error body for better messages
  const parsed = await parseInvokeError(error);

  const appError = handleError(error, {
    source: "edge_function",
    action,
    extra: {
      parsedMessage: parsed.message,
      parsedStatus: parsed.status,
      ...extra?.extra,
    },
    ...extra,
  });

  // Override with parsed message if available and more specific
  if (parsed.message && parsed.message !== appError.message) {
    appError.userMessage = mapToUserMessage(parsed.message, appError.code, parsed.status);
  }

  return appError;
}

/**
 * Handle fetch/network errors
 */
export function handleFetchError(
  error: unknown,
  action: string,
  extra?: Partial<ErrorContext>
): AppError {
  return handleError(error, {
    source: "fetch",
    action,
    ...extra,
  });
}

// ─── Helpers ────────────────────────────────────────────────────

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.msg === "string") return obj.msg;
  }
  return "Erro desconhecido";
}

function extractCode(error: unknown): string | undefined {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === "string") return obj.code;
    // Supabase PostgREST errors
    if (typeof obj.details === "string" && obj.details.includes("PGRST")) {
      return obj.details;
    }
  }
  return undefined;
}

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.statusCode === "number") return obj.statusCode;
    // Supabase FunctionsHttpError
    const ctx = (obj as any)?.context;
    if (ctx && typeof ctx.status === "number") return ctx.status;
  }
  return undefined;
}

export function mapToUserMessage(
  rawMessage: string,
  code?: string,
  status?: number
): string {
  // Check code first (more specific)
  if (code && USER_MESSAGES[code]) return USER_MESSAGES[code];

  // Check status
  if (status === 401 || status === 403) return "Sessão expirada ou sem permissão. Faça login novamente.";
  if (status === 404) return "Recurso não encontrado.";
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos.";
  if (status && status >= 500) return "Erro no servidor. Tente novamente em instantes.";

  // Check message patterns
  for (const [pattern, userMsg] of Object.entries(USER_MESSAGES)) {
    if (rawMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return userMsg;
    }
  }

  // Generic fallback
  return "Ocorreu um erro. Tente novamente.";
}

function isIgnoredError(message: string, code?: string, status?: number): boolean {
  // Don't send common/expected errors to Sentry
  const ignoredPatterns = [
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    "AbortError",
    "net::ERR_",
    "JWT expired",
    "PGRST301",
  ];
  const lowerMsg = message.toLowerCase();
  return ignoredPatterns.some((p) => lowerMsg.includes(p.toLowerCase()));
}
