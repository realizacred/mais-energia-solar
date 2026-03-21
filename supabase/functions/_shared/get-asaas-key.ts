/**
 * Shared helper: resolve Asaas API key for a tenant.
 * Priority: integration_configs → payment_gateway_config (legacy) → env fallback
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface AsaasKeyResult {
  apiKey: string;
  environment: string;
}

export async function getAsaasKey(
  supabaseAdmin: SupabaseClient,
  tenantId: string
): Promise<AsaasKeyResult | null> {
  // 1. Try integration_configs (new secure location)
  const { data: ic } = await supabaseAdmin
    .from("integration_configs")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("service_key", "asaas_api_key")
    .eq("is_active", true)
    .maybeSingle();

  // 2. Get environment from payment_gateway_config
  const { data: gwConfig } = await supabaseAdmin
    .from("payment_gateway_config")
    .select("api_key, environment, is_active")
    .eq("tenant_id", tenantId)
    .eq("provider", "asaas")
    .maybeSingle();

  const environment = gwConfig?.environment || "sandbox";

  // Prefer integration_configs key
  if (ic?.api_key) {
    return { apiKey: ic.api_key, environment };
  }

  // Fallback to legacy payment_gateway_config.api_key
  if (gwConfig?.api_key && gwConfig.api_key.length > 5) {
    return { apiKey: gwConfig.api_key, environment };
  }

  // Fallback to env var
  const envKey = Deno.env.get("ASAAS_BILLING_API_KEY");
  if (envKey) {
    return { apiKey: envKey, environment: Deno.env.get("ASAAS_BILLING_ENV") || "sandbox" };
  }

  return null;
}
