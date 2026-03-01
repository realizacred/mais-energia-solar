/**
 * Monitor Service — SSOT data access layer for ALL monitoring tables.
 * Never access monitoring tables directly from components.
 *
 * Consolidates both:
 *   - monitor_* tables (plants, health_cache, events, readings, devices)
 *   - monitoring_integrations / solar_plants / solar_plant_metrics_daily (legacy)
 */
import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
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

/**
 * POWER_KW_TO_ENERGY_ESTIMATE_HOURS: Used ONLY as a rough multiplier
 * when energy_kwh is null but power_kw is available.
 * NOT the same as HSP for PR calculation (which comes from irradiationService).
 * This is a conservative estimate for dashboard display purposes only.
 */
const POWER_KW_TO_ENERGY_ESTIMATE_HOURS = 4.5;

/**
 * LEGACY JOIN: Resolve a plantId that may be monitor_plants.id to its
 * legacy solar_plants.id (stored as legacy_plant_id in monitor_plants).
 * If the plantId already exists in solar_plants, returns it as-is.
 *
 * Uses an in-memory cache to avoid redundant queries within the same render cycle.
 */
const _legacyIdCache = new Map<string, string>();

async function resolveToLegacyPlantId(plantId: string): Promise<string> {
  if (_legacyIdCache.has(plantId)) return _legacyIdCache.get(plantId)!;

  // First check if it exists directly in solar_plants
  const { data: directMatch } = await supabase
    .from("solar_plants" as any)
    .select("id")
    .eq("id", plantId)
    .maybeSingle();
  if (directMatch) {
    _legacyIdCache.set(plantId, plantId);
    return plantId;
  }

  // Otherwise, look up monitor_plants.legacy_plant_id
  const { data: monitorPlant } = await supabase
    .from("monitor_plants" as any)
    .select("legacy_plant_id")
    .eq("id", plantId)
    .maybeSingle();
  const legacyId = (monitorPlant as any)?.legacy_plant_id || plantId;
  _legacyIdCache.set(plantId, legacyId);
  return legacyId;
}

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

function legacyStatusToHealth(sp: SolarPlant, m?: SolarPlantMetricsDaily, monthKwh?: number): MonitorHealthCache {
  const statusMap: Record<string, MonitorPlantStatus> = {
    normal: "online",
    offline: "offline",
    alarm: "alert",
    no_communication: "offline",
    unknown: "unknown",
  };

  // energy_kwh is the authoritative field; fallback: estimate from power_kw
  // power_kw from Solis V2 / Deye is actually watts (e.g. 3808 = 3.808 kW)
  // Estimate daily energy = power_kw_actual * AVG_SUN_HOURS (4.5h)
  let energyToday = 0;
  if (m?.energy_kwh != null && Number(m.energy_kwh) > 0) {
    energyToday = Number(m.energy_kwh);
  } else if (m?.power_kw != null && Number(m.power_kw) > 0) {
    // power_kw stores watts for some providers; convert to kW then estimate daily kWh
    const powerKw = Number(m.power_kw) > 100 ? Number(m.power_kw) / 1000 : Number(m.power_kw);
    energyToday = powerKw * POWER_KW_TO_ENERGY_ESTIMATE_HOURS; // approximate daily generation (NOT HSP for PR)
  }

  return {
    id: sp.id,
    tenant_id: sp.tenant_id,
    plant_id: sp.id,
    status: statusMap[sp.status] || "unknown",
    last_seen_at: sp.updated_at,
    energy_today_kwh: energyToday,
    energy_month_kwh: monthKwh ?? energyToday, // use month total if provided, else today
    performance_7d_pct: null,
    open_alerts_count: 0,
    updated_at: sp.updated_at,
  };
}
// ─── PLANTS + HEALTH (reads from legacy solar_plants) ─────────

export async function listPlantsWithHealth(): Promise<PlantWithHealth[]> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [{ data: plants }, { data: todayMetrics }, { data: monthMetrics }] = await Promise.all([
    supabase.from("solar_plants" as any).select("*").order("name", { ascending: true }),
    supabase.from("solar_plant_metrics_daily" as any).select("*").eq("date", today),
    supabase.from("solar_plant_metrics_daily" as any).select("plant_id, energy_kwh, power_kw").gte("date", monthStartStr).lte("date", today),
  ]);

  const todayMap = new Map<string, SolarPlantMetricsDaily>();
  ((todayMetrics as unknown as SolarPlantMetricsDaily[]) || []).forEach((m) =>
    todayMap.set(m.plant_id, m)
  );

  // Sum month energy per plant with power_kw fallback
  const monthMap = new Map<string, number>();
  ((monthMetrics as unknown as Array<{ plant_id: string; energy_kwh: number | null; power_kw: number | null }>) || []).forEach((r) => {
    let energy = 0;
    if (r.energy_kwh != null && Number(r.energy_kwh) > 0) {
      energy = Number(r.energy_kwh);
    } else if (r.power_kw != null && Number(r.power_kw) > 0) {
      const powerKw = Number(r.power_kw) > 100 ? Number(r.power_kw) / 1000 : Number(r.power_kw);
      energy = powerKw * POWER_KW_TO_ENERGY_ESTIMATE_HOURS; // NOT HSP for PR
    }
    monthMap.set(r.plant_id, (monthMap.get(r.plant_id) || 0) + energy);
  });

  return ((plants as unknown as SolarPlant[]) || []).map((sp) => {
    const m = todayMap.get(sp.id);
    return {
      ...mapSolarPlantToMonitorPlant(sp),
      health: legacyStatusToHealth(sp, m, monthMap.get(sp.id)),
      provider_name: sp.provider || undefined,
    };
  });
}

export async function getPlantDetail(plantId: string): Promise<PlantWithHealth | null> {
  // LEGACY JOIN: resolve monitor_plants.id → solar_plants.id if needed
  const resolvedId = await resolveToLegacyPlantId(plantId);
  const { data: plant } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .eq("id", resolvedId)
    .maybeSingle();

  if (!plant) return null;

  const sp = plant as unknown as SolarPlant;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  // Fetch today's metric + month readings in parallel (using resolvedId for legacy table)
  const [{ data: metric }, { data: monthMetrics }] = await Promise.all([
    supabase
      .from("solar_plant_metrics_daily" as any)
      .select("*")
      .eq("plant_id", resolvedId)
      .eq("date", today)
      .maybeSingle(),
    supabase
      .from("solar_plant_metrics_daily" as any)
      .select("energy_kwh, power_kw")
      .eq("plant_id", resolvedId)
      .gte("date", monthStartStr)
      .lte("date", today),
  ]);

  const m = metric as unknown as SolarPlantMetricsDaily | undefined;

  // Sum month energy with power_kw fallback
  let monthKwh = 0;
  ((monthMetrics as unknown as Array<{ energy_kwh: number | null; power_kw: number | null }>) || []).forEach((r) => {
    if (r.energy_kwh != null && Number(r.energy_kwh) > 0) {
      monthKwh += Number(r.energy_kwh);
    } else if (r.power_kw != null && Number(r.power_kw) > 0) {
      const powerKw = Number(r.power_kw) > 100 ? Number(r.power_kw) / 1000 : Number(r.power_kw);
      monthKwh += powerKw * POWER_KW_TO_ENERGY_ESTIMATE_HOURS; // NOT HSP for PR
    }
  });

  return {
    ...mapSolarPlantToMonitorPlant(sp),
    health: legacyStatusToHealth(sp, m, monthKwh),
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────

export async function getDashboardStats(): Promise<MonitorDashboardStats> {
  const plants = await listPlantsWithHealth();

  // Compute monthly energy from readings (last 30 days)
  const monthStart = new Date();
  monthStart.setDate(1);
  const todayStr = new Date().toISOString().slice(0, 10);
  const readings = await listAllReadings(monthStart.toISOString().slice(0, 10), todayStr);

  // Sum energy per plant, with power_kw fallback
  let totalMonthKwh = 0;
  readings.forEach((r) => {
    if (r.energy_kwh > 0) {
      totalMonthKwh += r.energy_kwh;
    } else if (r.peak_power_kw && r.peak_power_kw > 0) {
      const powerKw = r.peak_power_kw > 100 ? r.peak_power_kw / 1000 : r.peak_power_kw;
      totalMonthKwh += powerKw * POWER_KW_TO_ENERGY_ESTIMATE_HOURS; // NOT HSP for PR
    }
  });

  return {
    plants_online: plants.filter((p) => p.health?.status === "online").length,
    plants_alert: plants.filter((p) => p.health?.status === "alert").length,
    plants_offline: plants.filter((p) => p.health?.status === "offline").length,
    plants_unknown: plants.filter((p) => p.health?.status === "unknown").length,
    total_plants: plants.length,
    energy_today_kwh: plants.reduce((s, p) => s + (p.health?.energy_today_kwh || 0), 0),
    energy_month_kwh: totalMonthKwh,
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
  // LEGACY JOIN: resolve monitor_plants.id → solar_plants.id if needed
  const resolvedId = await resolveToLegacyPlantId(plantId);
  const { data } = await supabase
    .from("solar_plant_metrics_daily" as any)
    .select("*")
    .eq("plant_id", resolvedId)
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
  const allData: SolarPlantMetricsDaily[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("solar_plant_metrics_daily" as any)
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    const rows = (data as unknown as SolarPlantMetricsDaily[]) || [];
    allData.push(...rows);
    offset += BATCH_SIZE;
    hasMore = rows.length === BATCH_SIZE;
  }

  return allData.map((m) => ({
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
  if (error) {
    const parsed = await parseInvokeError(error);
    return { success: false, error: parsed.message };
  }
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
  if (error) {
    const parsed = await parseInvokeError(error);
    return { success: false, error: parsed.message };
  }
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
  if (error) {
    const parsed = await parseInvokeError(error);
    return { success: false, error: parsed.message };
  }
  if (data?.error) return { success: false, error: data.error };
  return { success: true, plants: data.plants || [] };
}

/** Delete a monitoring integration */
export async function disconnectProvider(integrationId: string): Promise<void> {
  // First delete related solar_plants
  await (supabase
    .from("solar_plants" as any)
    .delete()
    .eq("integration_id", integrationId) as any);

  // Then delete the integration itself
  await (supabase
    .from("monitoring_integrations" as any)
    .delete()
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