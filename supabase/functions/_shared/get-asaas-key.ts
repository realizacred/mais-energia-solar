/**
 * Shared helper: resolve Asaas API key for a tenant.
 * SSOT: integration_configs (service_key = "asaas_api_key")
 * Reads environment from payment_gateway_config (no api_key).
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
  // 1. Get key from integration_configs (only source)
  const { data: ic } = await supabaseAdmin
    .from("integration_configs")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("service_key", "asaas_api_key")
    .eq("is_active", true)
    .maybeSingle();

  if (!ic?.api_key) {
    return null;
  }

  // 2. Get environment from payment_gateway_config (config only, no key)
  const { data: gwConfig } = await supabaseAdmin
    .from("payment_gateway_config")
    .select("environment")
    .eq("tenant_id", tenantId)
    .eq("provider", "asaas")
    .maybeSingle();

  return {
    apiKey: ic.api_key,
    environment: gwConfig?.environment || "sandbox",
  };
}
