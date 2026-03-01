import { supabase } from "@/integrations/supabase/client";
import type { ConnectCredentials, MonitoringIntegration, MonitoringProvider, SolarPlant, SolarPlantMetricsDaily } from "./types";

/** Connect a monitoring provider */
export async function connectProvider(
  provider: MonitoringProvider,
  credentials: ConnectCredentials
): Promise<{ success: boolean; integration_id?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-connect", {
    body: { provider, login: credentials.login, password: credentials.password },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true, integration_id: data.integration_id };
}

/** Trigger a sync */
export async function syncProvider(
  provider: MonitoringProvider,
  mode: "plants" | "metrics" | "full" = "full"
): Promise<{ success: boolean; plants_synced?: number; metrics_synced?: number; errors?: string[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: { provider, mode },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return {
    success: true,
    plants_synced: data.plants_synced,
    metrics_synced: data.metrics_synced,
    errors: data.errors,
  };
}

/** Disconnect integration */
export async function disconnectProvider(integrationId: string): Promise<void> {
  await (supabase
    .from("monitoring_integrations" as any)
    .update({ status: "disconnected", tokens: {}, credentials: {} } as any)
    .eq("id", integrationId) as any);
}

/** Fetch integration for current tenant */
export async function getIntegration(
  provider: MonitoringProvider
): Promise<MonitoringIntegration | null> {
  const { data } = await supabase
    .from("monitoring_integrations" as any)
    .select("*")
    .eq("provider", provider)
    .maybeSingle();
  return (data as unknown as MonitoringIntegration) ?? null;
}

/** Fetch all integrations for current tenant */
export async function listIntegrations(): Promise<MonitoringIntegration[]> {
  const { data } = await supabase
    .from("monitoring_integrations" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return (data as unknown as MonitoringIntegration[]) || [];
}

/** Fetch solar plants for current tenant */
export async function listPlants(): Promise<SolarPlant[]> {
  const { data } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .order("name", { ascending: true });
  return (data as unknown as SolarPlant[]) || [];
}

/** Fetch today's metrics for all plants */
export async function getTodayMetrics(): Promise<SolarPlantMetricsDaily[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("date", today);
  return (data as unknown as SolarPlantMetricsDaily[]) || [];
}
