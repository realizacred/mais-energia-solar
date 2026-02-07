export type ParsedInvokeError = {
  message: string;
  status?: number;
};

/**
 * Supabase functions.invoke() retorna erros envolvidos em FunctionsHttpError, onde
 * o body real está em `error.context` (um Response) ou em `error.context.json()`.
 * Também pode retornar `error.message` genérico "Edge Function returned a non-2xx...".
 *
 * Esta função tenta extrair o body real para exibir mensagem útil ao usuário.
 */
export async function parseInvokeError(err: unknown): Promise<ParsedInvokeError> {
  const anyErr = err as Record<string, unknown> | null | undefined;
  const rawMsg = String((anyErr as any)?.message ?? "Erro ao executar a função");
  const status: number | undefined = (anyErr as any)?.context?.status ?? (anyErr as any)?.status;

  let message = rawMsg;

  const ctx = (anyErr as any)?.context;
  if (ctx && typeof ctx === "object") {
    // ctx pode ser um Response ou plain object
    if (typeof ctx.clone === "function") {
      // ctx é um Response
      try {
        const res: Response = ctx as Response;
        const cloned = res.clone();
        const contentType = cloned.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const json = await cloned.json();
          const extracted = extractMessage(json);
          if (extracted) message = extracted;
        } else {
          const text = await cloned.text();
          if (text) message = text;
        }
      } catch {
        // keep rawMsg
      }
    } else if (typeof ctx === "object" && ctx !== null) {
      // ctx pode ser o próprio body parseado em alguns casos
      const extracted = extractMessage(ctx);
      if (extracted) message = extracted;
    }
  }

  return { message, status };
}

function extractMessage(json: unknown): string | null {
  if (typeof json === "string") return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    const maybeError = obj.error ?? obj.message ?? obj.msg;
    if (maybeError && typeof maybeError === "string") return maybeError;
    // Se `error` é objeto, tenta stringify
    if (typeof maybeError === "object" && maybeError) {
      return JSON.stringify(maybeError);
    }
    // Fallback
    return JSON.stringify(json);
  }
  return null;
}

export function isEmailAlreadyRegisteredError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("email_exists") ||
    m.includes("email address has already been registered") ||
    m.includes("e-mail já") ||
    m.includes("email já")
  );
}
