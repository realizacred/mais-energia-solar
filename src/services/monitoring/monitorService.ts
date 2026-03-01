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
  MonitorPlantStatus,
  MonitorDevice,
  MonitorHealthCache,
  MonitorEvent,
  MonitorReadingDaily,
  PlantWithHealth,
  MonitorDashboardStats,
} from "./monitorTypes";
import type { MonitoringIntegration, SolarPlant, SolarPlantMetricsDaily } from "./types";

// ─── HELPERS: map legacy → v2 types ──────────────────────────

function mapSolarPlantToMonitorPlant(sp: SolarPlant): MonitorPlant {
  return {
    id: sp.id,
    tenant_id: sp.tenant_id,
    client_id: null,
    name: sp.name || "Usina",
    lat: sp.latitude,
    lng: sp.longitude,
    city: sp.address,
    state: null,
    installed_power_kwp: sp.capacity_kw,
    provider_id: sp.integration_id,
    provider_plant_id: sp.external_id,
    is_active: true,
    metadata: sp.metadata || {},
    created_at: sp.created_at,
    updated_at: sp.updated_at,
  };
}

function legacyStatusToHealth(sp: SolarPlant, m?: SolarPlantMetricsDaily): MonitorHealthCache {
  const statusMap: Record<string, MonitorPlantStatus> = {
    normal: "online",
    offline: "offline",
    alarm: "alert",
    no_communication: "offline",
    unknown: "unknown",
  };
  return {
    id: sp.id,
    tenant_id: sp.tenant_id,
    plant_id: sp.id,
    status: statusMap[sp.status] || "unknown",
    last_seen_at: sp.updated_at,
    energy_today_kwh: m?.energy_kwh != null ? Number(m.energy_kwh) : 0,
    energy_month_kwh: 0, // not available from daily metrics
    performance_7d_pct: null,
    open_alerts_count: 0,
    updated_at: sp.updated_at,
  };
}

// ─── PLANTS + HEALTH (reads from legacy solar_plants) ─────────

export async function listPlantsWithHealth(): Promise<PlantWithHealth[]> {
  const { data: plants } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .order("name", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const { data: metrics } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("date", today);

  const metricsMap = new Map<string, SolarPlantMetricsDaily>();
  ((metrics as unknown as SolarPlantMetricsDaily[]) || []).forEach((m) =>
    metricsMap.set(m.plant_id, m)
  );

  return ((plants as unknown as SolarPlant[]) || []).map((sp) => {
    const m = metricsMap.get(sp.id);
    return {
      ...mapSolarPlantToMonitorPlant(sp),
      health: legacyStatusToHealth(sp, m),
      provider_name: sp.provider || undefined,
    };
  });
}

export async function getPlantDetail(plantId: string): Promise<PlantWithHealth | null> {
  const { data: plant } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .eq("id", plantId)
    .maybeSingle();

  if (!plant) return null;

  const sp = plant as unknown as SolarPlant;
  const today = new Date().toISOString().slice(0, 10);
  const { data: metric } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("plant_id", plantId)
    .eq("date", today)
    .maybeSingle();

  const m = metric as unknown as SolarPlantMetricsDaily | undefined;
  return {
    ...mapSolarPlantToMonitorPlant(sp),
    health: legacyStatusToHealth(sp, m),
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────

export async function getDashboardStats(): Promise<MonitorDashboardStats> {
  const plants = await listPlantsWithHealth();

  return {
    plants_online: plants.filter((p) => p.health?.status === "online").length,
    plants_alert: plants.filter((p) => p.health?.status === "alert").length,
    plants_offline: plants.filter((p) => p.health?.status === "offline").length,
    plants_unknown: plants.filter((p) => p.health?.status === "unknown").length,
    total_plants: plants.length,
    energy_today_kwh: plants.reduce((s, p) => s + (p.health?.energy_today_kwh || 0), 0),
    energy_month_kwh: plants.reduce((s, p) => s + (p.health?.energy_month_kwh || 0), 0),
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

// ─── READINGS (reads from legacy solar_plant_metrics_daily) ───

export async function listDailyReadings(
  plantId: string,
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  const { data } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("plant_id", plantId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  return ((data as unknown as SolarPlantMetricsDaily[]) || []).map((m) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    plant_id: m.plant_id,
    date: m.date,
    energy_kwh: m.energy_kwh ?? 0,
    peak_power_kw: m.power_kw,
    metadata: m.metadata || {},
    created_at: m.created_at,
  }));
}

export async function listAllReadings(
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  const { data } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  return ((data as unknown as SolarPlantMetricsDaily[]) || []).map((m) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    plant_id: m.plant_id,
    date: m.date,
    energy_kwh: m.energy_kwh ?? 0,
    peak_power_kw: m.power_kw,
    metadata: m.metadata || {},
    created_at: m.created_at,
  }));
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
  mode: "plants" | "metrics" | "full" = "full",
  selectedPlantIds?: string[]
): Promise<{ success: boolean; plants_synced?: number; metrics_synced?: number; errors?: string[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: { provider, mode, selected_plant_ids: selectedPlantIds || null },
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

/** Discover plants from provider API without saving */
export interface DiscoveredPlant {
  external_id: string;
  name: string;
  capacity_kw: number | null;
  address: string | null;
  status: string;
}

export async function discoverPlants(provider: string): Promise<{ success: boolean; plants?: DiscoveredPlant[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: { provider, mode: "discover" },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true, plants: data.plants || [] };
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