/**
 * Shared utility to resolve Gotenberg URL from DB config → env fallback.
 * Used by docx-to-pdf and template-preview edge functions.
 */

function validateAndNormalizeBaseUrl(
  rawUrl: string | undefined,
  envVarName: string,
  defaultUrl = "https://demo.gotenberg.dev",
): string {
  const urlStr = (rawUrl && rawUrl.trim()) ? rawUrl.trim() : defaultUrl;

  if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
    throw new Error(
      `Configuração inválida: ${envVarName} ("${urlStr}") não possui protocolo válido (http/https). ` +
      `Verifique a configuração do Gotenberg na área de integrações.`
    );
  }

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Protocolo "${parsed.protocol}" não suportado.`);
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch (e: any) {
    throw new Error(
      `Configuração inválida: ${envVarName} ("${urlStr}") não é uma URL válida. ` +
      `Erro: ${e.message}. Verifique a configuração do Gotenberg.`
    );
  }
}

/**
 * Resolve Gotenberg base URL with priority:
 * 1. DB config (integration_connections for tenant)
 * 2. GOTENBERG_URL env var
 * 3. Demo fallback (only if explicitly allowed)
 */
export async function resolveGotenbergUrl(
  supabaseClient: any,
  tenantId?: string,
): Promise<string> {
  // 1. Try DB config
  if (tenantId) {
    try {
      const { data } = await supabaseClient
        .from("integration_connections")
        .select("config, status")
        .eq("provider_id", "gotenberg")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (data?.config?.enabled && data?.config?.base_url) {
        const url = validateAndNormalizeBaseUrl(data.config.base_url, "Gotenberg (DB)");
        console.log(`[resolveGotenbergUrl] Using DB config: ${url}`);
        return url;
      }
    } catch (err) {
      console.warn("[resolveGotenbergUrl] DB lookup failed, falling back to env:", err);
    }
  }

  // 2. Env fallback
  const rawGotenbergUrl = Deno.env.get("GOTENBERG_URL");
  const url = validateAndNormalizeBaseUrl(rawGotenbergUrl, "GOTENBERG_URL");
  console.log(`[resolveGotenbergUrl] Using env: ${url}`);
  return url;
}

export { validateAndNormalizeBaseUrl };
