/**
 * Service for monitor_integration_configs — CRUD for provider credentials.
 * Canonical data access, never access the table directly.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MonitorIntegrationConfig {
  id: string;
  tenant_id: string;
  provider_id: string;
  display_name: string | null;
  base_url: string | null;
  auth: Record<string, unknown>;
  meta: Record<string, unknown>;
  is_active: boolean;
  last_sync_at: string | null;
  last_events_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export async function listIntegrationConfigs(): Promise<MonitorIntegrationConfig[]> {
  const { data, error } = await supabase
    .from("monitor_integration_configs" as any)
    .select("*")
    .order("provider_id");
  if (error) throw error;
  return (data as unknown as MonitorIntegrationConfig[]) || [];
}

export async function getIntegrationConfig(providerId: string): Promise<MonitorIntegrationConfig | null> {
  const { data, error } = await supabase
    .from("monitor_integration_configs" as any)
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MonitorIntegrationConfig | null;
}

export async function upsertIntegrationConfig(params: {
  provider_id: string;
  display_name?: string;
  base_url?: string;
  auth: Record<string, unknown>;
  meta?: Record<string, unknown>;
  is_active?: boolean;
}): Promise<MonitorIntegrationConfig> {
  // Get tenant_id from current user profile
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles" as any)
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  const tenantId = (profile as any).tenant_id;

  const { data, error } = await supabase
    .from("monitor_integration_configs" as any)
    .upsert(
      {
        tenant_id: tenantId,
        provider_id: params.provider_id,
        display_name: params.display_name || null,
        base_url: params.base_url || null,
        auth: params.auth,
        meta: params.meta || {},
        is_active: params.is_active ?? false,
      } as any,
      { onConflict: "tenant_id,provider_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as unknown as MonitorIntegrationConfig;
}

export async function toggleIntegrationActive(providerId: string, isActive: boolean): Promise<void> {
  const config = await getIntegrationConfig(providerId);
  if (!config) throw new Error("Configuração não encontrada");

  const { error } = await supabase
    .from("monitor_integration_configs" as any)
    .update({ is_active: isActive } as any)
    .eq("id", config.id);
  if (error) throw error;
}

export async function deleteIntegrationConfig(providerId: string): Promise<void> {
  const config = await getIntegrationConfig(providerId);
  if (!config) return;

  const { error } = await supabase
    .from("monitor_integration_configs" as any)
    .delete()
    .eq("id", config.id);
  if (error) throw error;
}
