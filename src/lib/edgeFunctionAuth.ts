import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve auth headers explicitly for Edge Function calls that also send custom headers.
 * This avoids platform-level 401s when an invoke call needs timeout or extra headers.
 */
export async function getEdgeFunctionAuthHeaders(extraHeaders?: HeadersInit): Promise<Record<string, string>> {
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
    ...normalizedExtra,
  };
}
