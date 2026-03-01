import { supabase } from "@/integrations/supabase/client";
import type { IntegrationProvider, IntegrationConnection } from "./types";

/** Fetch all providers from catalog */
export async function listProviders(): Promise<IntegrationProvider[]> {
  const { data, error } = await supabase
    .from("integration_providers" as any)
    .select("id, category, label, description, logo_key, status, auth_type, credential_schema, tutorial, capabilities, platform_managed_keys, popularity, created_at, updated_at")
    .order("popularity", { ascending: false });
  if (error) throw error;
  return (data as unknown as IntegrationProvider[]) || [];
}

/** Fetch all connections for current tenant */
export async function listConnections(): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from("integration_connections" as any)
    .select("id, tenant_id, provider_id, status, credentials, tokens, config, last_sync_at, sync_error, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as IntegrationConnection[]) || [];
}

/** Connect a provider via edge function */
export async function connectProvider(
  providerId: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-connect", {
    body: { provider: providerId, credentials },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/** Sync a provider via edge function */
export async function syncProvider(
  providerId: string,
  mode: "full" | "partial" = "full"
): Promise<{ success: boolean; plants_synced?: number; metrics_synced?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: { provider: providerId, mode },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true, plants_synced: data?.plants_synced, metrics_synced: data?.metrics_synced };
}

/** Disconnect a provider */
export async function disconnectProvider(providerId: string): Promise<{ success: boolean; error?: string }> {
  const { data: connRaw } = await (supabase
    .from("integration_connections" as any)
    .select("id")
    .eq("provider_id", providerId)
    .single() as any);

  if (connRaw?.id) {
    await (supabase
      .from("integration_connections" as any)
      .update({ status: "disconnected", tokens: {}, credentials: {}, sync_error: null })
      .eq("id", connRaw.id) as any);
  }

  // Also disconnect from legacy monitoring_integrations if exists
  await supabase
    .from("monitoring_integrations" as any)
    .update({ status: "disconnected", tokens: {}, credentials: {} } as any)
    .eq("provider", providerId);

  return { success: true };
}
