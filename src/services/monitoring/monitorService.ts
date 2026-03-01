/**
 * Monitor Service — SSOT data access layer for ALL monitoring tables.
 * Never access monitoring tables directly from components.
 *
 * Consolidates both:
 *   - monitor_* tables (plants, health_cache, events, readings, devices)
 *   - monitoring_integrations / solar_plants / solar_plant_metrics_daily (legacy)
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  MonitorPlant,
  MonitorDevice,
  MonitorHealthCache,
  MonitorEvent,
  MonitorReadingDaily,
  PlantWithHealth,
  MonitorDashboardStats,
} from "./monitorTypes";
import type { MonitoringIntegration, SolarPlant, SolarPlantMetricsDaily } from "./types";

// ─── PLANTS + HEALTH ──────────────────────────────────────────

export async function listPlantsWithHealth(): Promise<PlantWithHealth[]> {
  const { data: plants } = await supabase
    .from("monitor_plants" as any)
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  const { data: healthRows } = await supabase
    .from("monitor_health_cache" as any)
    .select("*");

  const healthMap = new Map<string, MonitorHealthCache>();
  ((healthRows as unknown as MonitorHealthCache[]) || []).forEach((h) =>
    healthMap.set(h.plant_id, h)
  );

  return ((plants as unknown as MonitorPlant[]) || []).map((p) => ({
    ...p,
    health: healthMap.get(p.id),
  }));
}

export async function getPlantDetail(plantId: string): Promise<PlantWithHealth | null> {
  const { data: plant } = await supabase
    .from("monitor_plants" as any)
    .select("*")
    .eq("id", plantId)
    .maybeSingle();

  if (!plant) return null;

  const { data: health } = await supabase
    .from("monitor_health_cache" as any)
    .select("*")
    .eq("plant_id", plantId)
    .maybeSingle();

  return {
    ...(plant as unknown as MonitorPlant),
    health: (health as unknown as MonitorHealthCache) ?? undefined,
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────

export async function getDashboardStats(): Promise<MonitorDashboardStats> {
  const { data: healthRows } = await supabase
    .from("monitor_health_cache" as any)
    .select("*");

  const rows = (healthRows as unknown as MonitorHealthCache[]) || [];

  return {
    plants_online: rows.filter((r) => r.status === "online").length,
    plants_alert: rows.filter((r) => r.status === "alert").length,
    plants_offline: rows.filter((r) => r.status === "offline").length,
    plants_unknown: rows.filter((r) => r.status === "unknown").length,
    total_plants: rows.length,
    energy_today_kwh: rows.reduce((s, r) => s + (r.energy_today_kwh || 0), 0),
    energy_month_kwh: rows.reduce((s, r) => s + (r.energy_month_kwh || 0), 0),
  };
}

// ─── DEVICES ──────────────────────────────────────────────────

export async function listDevices(plantId: string): Promise<MonitorDevice[]> {
  const { data } = await supabase
    .from("monitor_devices" as any)
    .select("*")
    .eq("plant_id", plantId)
    .order("type", { ascending: true });
  return (data as unknown as MonitorDevice[]) || [];
}

// ─── EVENTS / ALERTS ──────────────────────────────────────────

export async function listAlerts(filters?: {
  plantId?: string;
  isOpen?: boolean;
  severity?: string;
}): Promise<MonitorEvent[]> {
  let q = supabase
    .from("monitor_events" as any)
    .select("*")
    .order("starts_at", { ascending: false });

  if (filters?.plantId) q = q.eq("plant_id", filters.plantId);
  if (filters?.isOpen !== undefined) q = q.eq("is_open", filters.isOpen);
  if (filters?.severity) q = q.eq("severity", filters.severity);

  const { data } = await q.limit(200);
  return (data as unknown as MonitorEvent[]) || [];
}

// ─── READINGS ─────────────────────────────────────────────────

export async function listDailyReadings(
  plantId: string,
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  const { data } = await supabase
    .from("monitor_readings_daily" as any)
    .select("*")
    .eq("plant_id", plantId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return (data as unknown as MonitorReadingDaily[]) || [];
}

export async function listAllReadings(
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  const { data } = await supabase
    .from("monitor_readings_daily" as any)
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  return (data as unknown as MonitorReadingDaily[]) || [];
}

// ═══════════════════════════════════════════════════════════════
// LEGACY TABLES: monitoring_integrations + solar_plants + metrics
// (used by MonitoringPage v1 and IntegrationsCatalog)
// ═══════════════════════════════════════════════════════════════

/** Connect a monitoring provider via Edge Function */
export async function connectProvider(
  provider: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; integration_id?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-connect", {
    body: { provider, credentials },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true, integration_id: data.integration_id };
}

/** Trigger a sync via Edge Function */
export async function syncProvider(
  provider: string,
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

/** Disconnect a monitoring integration */
export async function disconnectProvider(integrationId: string): Promise<void> {
  await (supabase
    .from("monitoring_integrations" as any)
    .update({ status: "disconnected", tokens: {}, credentials: {} } as any)
    .eq("id", integrationId) as any);
}

/** Fetch integration for current tenant by provider key */
export async function getIntegration(provider: string): Promise<MonitoringIntegration | null> {
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

/** Fetch solar plants (legacy table) for current tenant */
export async function listSolarPlants(): Promise<SolarPlant[]> {
  const { data } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .order("name", { ascending: true });
  return (data as unknown as SolarPlant[]) || [];
}

/** Fetch today's metrics for all solar plants (legacy table) */
export async function getTodayMetrics(): Promise<SolarPlantMetricsDaily[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("date", today);
  return (data as unknown as SolarPlantMetricsDaily[]) || [];
}