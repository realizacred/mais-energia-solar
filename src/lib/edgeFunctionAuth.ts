import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers explícitos para chamadas HTTP diretas às Edge Functions.
 * Evita 401 intermitente do gateway quando custom headers são usados.
 */
export async function getEdgeFunctionAuthHeaders(extraHeaders?: HeadersInit): Promise<Record<string, string>> {
  await supabase.auth.refreshSession();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const normalizedExtra = extraHeaders instanceof Headers
    ? Object.fromEntries(extraHeaders.entries())
    : Array.isArray(extraHeaders)
      ? Object.fromEntries(extraHeaders)
      : (extraHeaders ?? {});

  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ...normalizedExtra,
  };
}

export async function invokeEdgeFunction<TResponse = unknown>(
  functionName: string,
  options?: {
    body?: unknown;
    method?: string;
    headers?: HeadersInit;
  }
): Promise<TResponse> {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL;
  const headers = await getEdgeFunctionAuthHeaders({
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  });

  const response = await fetch(`${projectUrl}/functions/v1/${functionName}`, {
    method: options?.method ?? "POST",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(message || `HTTP ${response.status}`);
  }

  return payload as TResponse;
}
