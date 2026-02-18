/**
 * Robustly extracts a Portuguese error message from supabase.functions.invoke() errors.
 * 
 * supabase-js FunctionsHttpError sets `message` to HTTP status text ("Unauthorized"),
 * and the JSON body may be in `context` (a Response object whose body might be consumed).
 * This helper tries every possible path to get the real error message.
 */
export async function parseEdgeFunctionError(
  error: any,
  fallbackMessage = "Erro ao processar requisição"
): Promise<string> {
  // 1. Try reading the error message as JSON (some versions embed the body here)
  try {
    const parsed = JSON.parse(error.message);
    if (parsed?.error) {
      return parsed.details
        ? `${parsed.error}: ${parsed.details}`
        : parsed.error;
    }
  } catch {
    // Not JSON, continue
  }

  // 2. Try reading the context (Response object)
  try {
    const ctx = error?.context;
    if (ctx) {
      let body: any = null;
      if (typeof ctx.json === "function") {
        body = await ctx.json();
      } else if (ctx.body) {
        const text = await new Response(ctx.body).text();
        try { body = JSON.parse(text); } catch {}
      }
      if (body?.error) {
        return body.details
          ? `${body.error}: ${body.details}`
          : body.error;
      }
    }
  } catch {
    // Context body already consumed or unavailable
  }

  // 3. Translate known HTTP status text to Portuguese
  const rawMsg = (error?.message || "").toLowerCase();
  if (rawMsg.includes("unauthorized") || rawMsg.includes("401")) {
    return "Sessão expirada ou inválida. Faça login novamente.";
  }
  if (rawMsg.includes("forbidden") || rawMsg.includes("403")) {
    return "Acesso negado: permissão insuficiente.";
  }
  if (rawMsg.includes("not found") || rawMsg.includes("404")) {
    return "Serviço não encontrado. Tente novamente mais tarde.";
  }
  if (rawMsg.includes("internal") || rawMsg.includes("500")) {
    return "Erro interno do servidor. Tente novamente.";
  }
  if (rawMsg.includes("timeout") || rawMsg.includes("gateway")) {
    return "Tempo de resposta esgotado. Tente novamente.";
  }

  // 4. If message exists and is not just a generic status text, use it
  if (error?.message && error.message.length > 3) {
    return error.message;
  }

  return fallbackMessage;
}
