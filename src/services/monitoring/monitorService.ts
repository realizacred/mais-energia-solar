/**
 * Monitor Service — SSOT data access layer for ALL monitoring tables.
 * Never access monitoring tables directly from components.
 *
 * Consolidates both:
 *   - monitor_* tables (plants, health_cache, events, readings, devices)
 *   - monitoring_integrations / solar_plants (legacy)
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
import {
  derivePlantStatus, getTodayBrasilia, getMonthStartBrasilia, getDaysAgoBrasilia, isBrasiliaNight,
  normalizePowerKw, extractDailyEnergy, sumMonthlyEnergy, POWER_KW_TO_ENERGY_ESTIMATE_HOURS,
} from "./plantStatusEngine";

/**
 * LEGACY JOIN: Resolve a plantId that may be monitor_plants.id to its
 * legacy solar_plants.id (stored as legacy_plant_id in monitor_plants).
 * If the plantId already exists in solar_plants, returns it as-is.
 *
 * Cache is scoped by tenantId and entries expire after TTL_MS to avoid stale data.
 */
const LEGACY_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const _legacyIdCache = new Map<string, { value: string; expiresAt: number }>();

async function resolveToLegacyPlantId(plantId: string): Promise<string> {
  // Resolve tenant for cache scoping (best-effort, falls back to global key)
  const { data: { user } } = await supabase.auth.getUser();
  const tenantKey = user?.id ? `${user.id}:${plantId}` : plantId;

  const cached = _legacyIdCache.get(tenantKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // First check if it exists directly in solar_plants
  const { data: directMatch } = await supabase
    .from("solar_plants" as any)
    .select("id")
    .eq("id", plantId)
    .maybeSingle();
  if (directMatch) {
    _legacyIdCache.set(tenantKey, { value: plantId, expiresAt: Date.now() + LEGACY_CACHE_TTL_MS });
    return plantId;
  }

  // Otherwise, look up monitor_plants.legacy_plant_id
  const { data: monitorPlant } = await supabase
    .from("monitor_plants" as any)
    .select("legacy_plant_id")
    .eq("id", plantId)
    .maybeSingle();
  const legacyId = (monitorPlant as any)?.legacy_plant_id || plantId;
  _legacyIdCache.set(tenantKey, { value: legacyId, expiresAt: Date.now() + LEGACY_CACHE_TTL_MS });
  return legacyId;
}

// ─── HELPERS: map legacy → v2 types ──────────────────────────

function mapSolarPlantToMonitorPlant(sp: SolarPlant, clientId?: string | null): MonitorPlant {
  return {
    id: sp.id,
    tenant_id: sp.tenant_id,
    client_id: clientId ?? null,
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

function getMostRecentTimestamp(...timestamps: Array<string | null | undefined>): string | null {
  return timestamps
    .filter((value): value is string => {
      if (!value) return false;
      return !Number.isNaN(new Date(value).getTime());
    })
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
}

function legacyStatusToHealth(
  sp: SolarPlant,
  m?: SolarPlantMetricsDaily,
  monthKwh?: number,
  yesterdayMetric?: SolarPlantMetricsDaily,
  openAlertCount?: number,
  /** SSOT: plant_seen_at = MAX(device.last_seen_at) with solar_plants.updated_at fallback */
  bestLastSeenAt?: string | null,
): MonitorHealthCache {
  // SSOT: canonical plant timestamp — prefer device-derived, fallback to solar_plants.updated_at
  // solar_plants.updated_at IS updated by sync and is reliable when monitor_devices has no entry
  const canonicalLastSeen = bestLastSeenAt || sp.updated_at || null;

  // SSOT: use extractDailyEnergy helper
  let energyToday = extractDailyEnergy(m?.energy_kwh ?? null, m?.power_kw ?? null);

  // Yesterday fallback: when today has no data AND it's night, show yesterday's energy
  let isYesterdayFallback = false;
  if (energyToday === 0 && isBrasiliaNight() && yesterdayMetric) {
    const yesterdayEnergy = extractDailyEnergy(yesterdayMetric.energy_kwh ?? null, yesterdayMetric.power_kw ?? null);
    if (yesterdayEnergy > 0) {
      energyToday = yesterdayEnergy;
      isYesterdayFallback = true;
    }
  }

  // SSOT: normalizePowerKw
  const currentPowerKw = normalizePowerKw(m?.power_kw != null ? Number(m.power_kw) : null);

  // SSOT: pass the RAW provider status to the engine — never override it here.
  // The engine is the ONLY place that decides what to do with provider status.
  const { uiStatus } = derivePlantStatus({
    updated_at: canonicalLastSeen,
    power_kw: m?.power_kw != null ? Number(m.power_kw) : null,
    energy_today_kwh: energyToday,
    provider_status: sp.status,
  });

  // Map engine status to MonitorPlantStatus for backward compat
  const statusForHealth: MonitorPlantStatus = uiStatus === "standby" ? "standby" : uiStatus;

  return {
    id: sp.id,
    tenant_id: sp.tenant_id,
    plant_id: sp.id,
    status: statusForHealth,
    last_seen_at: canonicalLastSeen,
    energy_today_kwh: energyToday,
    energy_month_kwh: monthKwh ?? energyToday,
    current_power_kw: currentPowerKw > 0 ? currentPowerKw : 0,
    performance_7d_pct: null,
    open_alerts_count: openAlertCount ?? 0,
    updated_at: canonicalLastSeen,
    is_yesterday_fallback: isYesterdayFallback,
  };
}
// ─── PLANTS + HEALTH (reads from legacy solar_plants + v2 view) ─────────

export async function listPlantsWithHealth(): Promise<PlantWithHealth[]> {
  const yesterday = getDaysAgoBrasilia(1);

  // ── Batch 1: plants + v2 metrics view + yesterday fallback ──
  const [{ data: plants }, { data: viewRows }, { data: yesterdayMetrics }] = await Promise.all([
    supabase.from("solar_plants" as any).select("*").order("name", { ascending: true }),
    supabase.from("monitor_plants_with_metrics").select("*"),
    supabase.from("monitor_readings_daily").select("plant_id, energy_kwh, peak_power_kw").eq("date", yesterday),
  ]);

  const plantList = (plants as unknown as SolarPlant[]) || [];
  if (plantList.length === 0) return [];

  const tenantId = plantList[0]?.tenant_id;
  const plantIds = plantList.map((p) => p.id);

  // Build map from v2 view: legacy_plant_id → view row
  type ViewRow = {
    id: string; legacy_plant_id: string | null; client_id: string | null;
    last_seen_at: string | null; today_energy_kwh: number | null;
    today_peak_power_kw: number | null; month_energy_kwh: number | null;
  };
  const viewList = (viewRows as unknown as ViewRow[]) || [];
  const viewByLegacy = new Map<string, ViewRow>();
  const mpIdToLegacy = new Map<string, string>();
  const mpIds: string[] = [];
  viewList.forEach((r) => {
    if (r.legacy_plant_id) {
      viewByLegacy.set(r.legacy_plant_id, r);
      mpIdToLegacy.set(r.id, r.legacy_plant_id);
    }
    mpIds.push(r.id);
  });

  // Yesterday fallback map (monitor_plants.id → energy)
  const yesterdayMap = new Map<string, SolarPlantMetricsDaily>();
  ((yesterdayMetrics as unknown as Array<{ plant_id: string; energy_kwh: number | null; peak_power_kw: number | null }>) || []).forEach((m) => {
    const legacyId = mpIdToLegacy.get(m.plant_id);
    if (legacyId) {
      yesterdayMap.set(legacyId, {
        id: "", tenant_id: "", plant_id: legacyId, date: yesterday,
        energy_kwh: m.energy_kwh, power_kw: m.peak_power_kw,
        total_energy_kwh: null, metadata: {}, created_at: "",
      });
    }
  });

  // ── Batch 2: Alert counts + devices + clients ──
  const clientIds = Array.from(new Set(
    viewList.map((r) => r.client_id).filter((id): id is string => !!id)
  ));

  const [alertResult, devResult, clientResult] = await Promise.all([
    tenantId
      ? supabase.rpc("fn_monitor_open_alert_counts" as any, { _tenant_id: tenantId })
      : Promise.resolve({ data: null }),
    mpIds.length > 0
      ? supabase
          .from("monitor_devices" as any)
          .select("plant_id, last_seen_at")
          .in("plant_id", mpIds)
          .not("last_seen_at", "is", null)
      : Promise.resolve({ data: null }),
    clientIds.length > 0
      ? supabase.from("clientes").select("id, nome").in("id", clientIds)
      : Promise.resolve({ data: null }),
  ]);

  // Process alert counts
  const alertMap = new Map<string, number>();
  ((alertResult.data as unknown as Array<{ solar_plant_id: string; open_count: number }>) || []).forEach((a) => {
    if (a.solar_plant_id) alertMap.set(a.solar_plant_id, a.open_count);
  });

  // Process device last_seen_at
  const deviceSeenMap = new Map<string, string>();
  ((devResult.data as unknown as Array<{ plant_id: string; last_seen_at: string }>) || []).forEach((d) => {
    const legacyId = mpIdToLegacy.get(d.plant_id);
    if (!legacyId) return;
    const existing = deviceSeenMap.get(legacyId);
    if (!existing || d.last_seen_at > existing) {
      deviceSeenMap.set(legacyId, d.last_seen_at);
    }
  });

  // Process client names
  const clientNameMap = new Map<string, string>();
  ((clientResult.data as unknown as Array<{ id: string; nome: string }>) || []).forEach((c) => {
    clientNameMap.set(c.id, c.nome);
  });

  // ── Assemble results ──
  return plantList.map((sp) => {
    const vr = viewByLegacy.get(sp.id);

    // Build a synthetic SolarPlantMetricsDaily for today from the v2 view
    const todayMetric: SolarPlantMetricsDaily | undefined = vr ? {
      id: "", tenant_id: sp.tenant_id, plant_id: sp.id, date: getTodayBrasilia(),
      energy_kwh: vr.today_energy_kwh, power_kw: vr.today_peak_power_kw,
      total_energy_kwh: null, metadata: {}, created_at: "",
    } : undefined;

    const monthKwh = vr?.month_energy_kwh ?? 0;

    const maxDeviceSeen = deviceSeenMap.get(sp.id) || null;
    const monitorPlantSeen = vr?.last_seen_at || null;
    const bestLastSeen = getMostRecentTimestamp(maxDeviceSeen, monitorPlantSeen) || sp.updated_at || null;
    const health = legacyStatusToHealth(sp, todayMetric, monthKwh, yesterdayMap.get(sp.id), alertMap.get(sp.id), bestLastSeen);

    const cId = vr?.client_id || null;
    return {
      ...mapSolarPlantToMonitorPlant(sp, cId),
      health,
      provider_name: sp.provider || undefined,
      client_name: cId ? (clientNameMap.get(cId) || null) : null,
    };
  });
}

export async function getPlantDetail(plantId: string): Promise<PlantWithHealth | null> {
  const resolvedId = await resolveToLegacyPlantId(plantId);
  const { data: plant } = await supabase
    .from("solar_plants" as any)
    .select("*")
    .eq("id", resolvedId)
    .maybeSingle();

  if (!plant) return null;

  const sp = plant as unknown as SolarPlant;
  const today = getTodayBrasilia();
  const yesterday = getDaysAgoBrasilia(1);
  const monthStartStr = getMonthStartBrasilia();

  // Resolve monitor_plants.id for this legacy plant
  const { data: mpRow } = await supabase
    .from("monitor_plants" as any)
    .select("id, client_id, last_seen_at")
    .eq("legacy_plant_id", resolvedId)
    .maybeSingle();

  const monitorPlantId = (mpRow as any)?.id || null;

  // Use v2 tables for metrics (monitor_readings_daily)
  const metricsQueries = monitorPlantId
    ? [
        supabase.from("monitor_readings_daily").select("*").eq("plant_id", monitorPlantId).eq("date", today).maybeSingle(),
        supabase.from("monitor_readings_daily").select("*").eq("plant_id", monitorPlantId).eq("date", yesterday).maybeSingle(),
        supabase.from("monitor_readings_daily").select("energy_kwh, peak_power_kw").eq("plant_id", monitorPlantId).gte("date", monthStartStr).lte("date", today),
      ]
    : [
        // No monitor_plants mapping — return empty results
        Promise.resolve({ data: null, error: null }),
        Promise.resolve({ data: null, error: null }),
        Promise.resolve({ data: [], error: null }),
      ];

  const [{ data: metric }, { data: yesterdayMetric }, { data: monthMetrics }, { data: alertRows }] = await Promise.all([
    ...metricsQueries,
    supabase.from("monitor_events" as any).select("id").eq("solar_plant_id", resolvedId).eq("tenant_id", sp.tenant_id).eq("is_open", true),
  ]);

  // Normalize metrics to SolarPlantMetricsDaily shape for legacyStatusToHealth
  const m = monitorPlantId
    ? (metric ? { id: "", tenant_id: sp.tenant_id, plant_id: resolvedId, date: today,
        energy_kwh: (metric as any).energy_kwh, power_kw: (metric as any).peak_power_kw,
        total_energy_kwh: null, metadata: {}, created_at: "" } as SolarPlantMetricsDaily : undefined)
    : (metric as unknown as SolarPlantMetricsDaily | undefined);

  const ym = monitorPlantId
    ? (yesterdayMetric ? { id: "", tenant_id: sp.tenant_id, plant_id: resolvedId, date: yesterday,
        energy_kwh: (yesterdayMetric as any).energy_kwh, power_kw: (yesterdayMetric as any).peak_power_kw,
        total_energy_kwh: null, metadata: {}, created_at: "" } as SolarPlantMetricsDaily : undefined)
    : (yesterdayMetric as unknown as SolarPlantMetricsDaily | undefined);

  // SSOT: sumMonthlyEnergy
  const monthRows = monitorPlantId
    ? ((monthMetrics as unknown as Array<{ energy_kwh: number | null; peak_power_kw: number | null }>) || [])
        .map((r) => ({ energy_kwh: r.energy_kwh, power_kw: r.peak_power_kw }))
    : ((monthMetrics as unknown as Array<{ energy_kwh: number | null; power_kw: number | null }>) || []);
  const monthKwh = sumMonthlyEnergy(monthRows);

  const openAlertCount = ((alertRows as unknown as any[]) || []).length;

  // SSOT: Fetch MAX(monitor_devices.last_seen_at) + client_id for this plant
  let maxDeviceSeen: string | null = null;
  let monitorPlantLastSeen: string | null = null;
  let plantClientId: string | null = null;
  let plantClientName: string | null = null;
  if (mpRow) {
    plantClientId = (mpRow as any).client_id || null;
    monitorPlantLastSeen = (mpRow as any).last_seen_at || null;
    const { data: devRows } = await supabase
      .from("monitor_devices" as any)
      .select("last_seen_at")
      .eq("plant_id", (mpRow as any).id)
      .not("last_seen_at", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(1);
    const topDev = (devRows as unknown as Array<{ last_seen_at: string }>) || [];
    if (topDev.length > 0) maxDeviceSeen = topDev[0].last_seen_at;
  }
  if (plantClientId) {
    const { data: clientRow } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", plantClientId)
      .maybeSingle();
    plantClientName = (clientRow as any)?.nome || null;
  }

  const bestLastSeen = getMostRecentTimestamp(maxDeviceSeen, monitorPlantLastSeen);

  return {
    ...mapSolarPlantToMonitorPlant(sp, plantClientId),
    health: legacyStatusToHealth(sp, m, monthKwh, ym, openAlertCount, bestLastSeen),
    client_name: plantClientName,
  };
}

// ─── DASHBOARD ────────────────────────────────────────────────

export async function getDashboardStats(): Promise<MonitorDashboardStats> {
  const plants = await listPlantsWithHealth();

  // SSOT: monthly energy = sum of each plant's health.energy_month_kwh
  // (already computed via monitor_plants_with_metrics view in listPlantsWithHealth)
  // No separate listAllReadings call — single source of truth.
  const totalMonthKwh = plants.reduce((s, p) => s + (p.health?.energy_month_kwh || 0), 0);

  // SSOT: real current power = sum of all plants' current_power_kw (not estimated)
  const currentPowerKw = plants.reduce((s, p) => s + (p.health?.current_power_kw || 0), 0);

  return {
    plants_online: plants.filter((p) => p.health?.status === "online").length,
    plants_standby: plants.filter((p) => p.health?.status === "standby").length,
    // SSOT: plants_alert = plants with open alerts, NOT status === "alert"
    plants_alert: plants.filter((p) => (p.health?.open_alerts_count || 0) > 0).length,
    plants_offline: plants.filter((p) => p.health?.status === "offline").length,
    plants_unknown: plants.filter((p) => !p.health?.status || p.health.status === "unknown").length,
    total_plants: plants.length,
    energy_today_kwh: plants.reduce((s, p) => s + (p.health?.energy_today_kwh || 0), 0),
    energy_month_kwh: totalMonthKwh,
    current_power_kw: currentPowerKw,
  };
}

// ─── DEVICES ──────────────────────────────────────────────────

export async function listDevices(plantId: string): Promise<MonitorDevice[]> {
  // Try with the given plantId first (covers monitor_plants.id)
  const { data } = await supabase
    .from("monitor_devices" as any)
    .select("*")
    .eq("plant_id", plantId)
    .order("type", { ascending: true });

  if (data && data.length > 0) {
    return data as unknown as MonitorDevice[];
  }

  // Fallback: plantId might be a legacy solar_plants.id — resolve to monitor_plants.id
  const { data: monitorPlant } = await supabase
    .from("monitor_plants" as any)
    .select("id")
    .eq("legacy_plant_id", plantId)
    .maybeSingle();

  if (monitorPlant) {
    const { data: devicesFromMonitor } = await supabase
      .from("monitor_devices" as any)
      .select("*")
      .eq("plant_id", (monitorPlant as any).id)
      .order("type", { ascending: true });
    return (devicesFromMonitor as unknown as MonitorDevice[]) || [];
  }

  return [];
}

export interface SyncResult {
  plants_synced: number;
  metrics_synced: number;
  errors: string[];
}

/**
 * Trigger a manual sync for devices of a plant via the monitoring-sync edge function.
 * Returns sync result with counts for smarter UI feedback.
 */
export async function syncPlantDevices(plantId: string): Promise<SyncResult> {
  // Resolve monitor_plant → integration
  const { data: monitorPlant } = await supabase
    .from("monitor_plants" as any)
    .select("id, provider_id, legacy_plant_id")
    .or(`id.eq.${plantId},legacy_plant_id.eq.${plantId}`)
    .maybeSingle();

  if (!monitorPlant) throw new Error("Usina não encontrada no monitoramento");

  const mp = monitorPlant as any;

  // Find integration for this provider
  const { data: integration } = await supabase
    .from("monitoring_integrations" as any)
    .select("id, provider")
    .eq("provider", mp.provider_id)
    .maybeSingle();

  if (!integration) throw new Error("Integração não encontrada para este provedor");

  const int = integration as any;

  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: {
      integrationId: int.id,
      provider: int.provider,
      mode: "full",
      selected_plant_ids: [mp.id],
    },
  });

  if (error) {
    const parsed = await parseInvokeError(error);
    throw new Error(parsed.message || "Erro ao sincronizar");
  }

  return {
    plants_synced: data?.plants_synced ?? 0,
    metrics_synced: data?.metrics_synced ?? 0,
    errors: data?.errors ?? [],
  };
}

// ─── EVENTS / ALERTS ──────────────────────────────────────────

export async function listAlerts(filters?: {
  plantId?: string;
  isOpen?: boolean;
  severity?: string;
}): Promise<MonitorEvent[]> {
  // SSOT: query by solar_plant_id first; if no results, fallback for pre-migration data
  if (filters?.plantId) {
    let q = supabase
      .from("monitor_events" as any)
      .select("*")
      .eq("solar_plant_id", filters.plantId)
      .order("starts_at", { ascending: false });
    if (filters.isOpen !== undefined) q = q.eq("is_open", filters.isOpen);
    if (filters.severity) q = q.eq("severity", filters.severity);
    const { data } = await q.limit(200);
    const results = (data as unknown as MonitorEvent[]) || [];

    // Fallback: pre-migration events with solar_plant_id NULL
    if (results.length === 0) {
      let fallback = supabase
        .from("monitor_events" as any)
        .select("*")
        .eq("plant_id", filters.plantId)
        .is("solar_plant_id", null)
        .order("starts_at", { ascending: false });
      if (filters.isOpen !== undefined) fallback = fallback.eq("is_open", filters.isOpen);
      if (filters.severity) fallback = fallback.eq("severity", filters.severity);
      const { data: fbData } = await fallback.limit(200);
      return (fbData as unknown as MonitorEvent[]) || [];
    }
    return results;
  }

  // No plantId filter — return all
  let q = supabase
    .from("monitor_events" as any)
    .select("*")
    .order("starts_at", { ascending: false });
  if (filters?.isOpen !== undefined) q = q.eq("is_open", filters.isOpen);
  if (filters?.severity) q = q.eq("severity", filters.severity);
  const { data } = await q.limit(200);
  return (data as unknown as MonitorEvent[]) || [];
}

// ─── READINGS (v2: monitor_readings_daily with legacy plant_id compat) ───

/**
 * Resolve a plantId (which may be legacy solar_plants.id OR monitor_plants.id)
 * to monitor_plants.id for querying monitor_readings_daily.
 */
async function resolveToMonitorPlantId(plantId: string): Promise<{ monitorId: string | null; legacyId: string }> {
  // Check if it's already a monitor_plants.id
  const { data: directMp } = await supabase
    .from("monitor_plants" as any)
    .select("id, legacy_plant_id")
    .eq("id", plantId)
    .maybeSingle();
  if (directMp) {
    return { monitorId: (directMp as any).id, legacyId: (directMp as any).legacy_plant_id || plantId };
  }

  // It's a legacy solar_plants.id — find the monitor_plants row
  const { data: mpRow } = await supabase
    .from("monitor_plants" as any)
    .select("id")
    .eq("legacy_plant_id", plantId)
    .maybeSingle();

  return { monitorId: (mpRow as any)?.id || null, legacyId: plantId };
}

export async function listDailyReadings(
  plantId: string,
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  const { monitorId, legacyId } = await resolveToMonitorPlantId(plantId);

  if (monitorId) {
    // Use RPC for single-plant queries
    const { data } = await supabase.rpc("get_plant_metrics", {
      p_plant_id: monitorId,
      p_date_from: startDate,
      p_date_to: endDate,
    });

    return ((data as unknown as Array<{ date: string; energy_kwh: number; peak_power_kw: number }>) || []).map((r) => ({
      id: `${monitorId}_${r.date}`,
      tenant_id: "",
      plant_id: legacyId, // Return legacy ID for consumer compatibility
      date: r.date,
      energy_kwh: r.energy_kwh ?? 0,
      peak_power_kw: r.peak_power_kw,
      metadata: {},
      created_at: "",
    }));
  }

  // No monitor_plants mapping found — no metrics available
  return [];
}

export async function listAllReadings(
  startDate: string,
  endDate: string
): Promise<MonitorReadingDaily[]> {
  // Build legacy_plant_id lookup map
  const { data: mpRows } = await supabase
    .from("monitor_plants" as any)
    .select("id, legacy_plant_id");
  const idMap = new Map<string, string>();
  ((mpRows as unknown as Array<{ id: string; legacy_plant_id: string | null }>) || []).forEach((r) => {
    if (r.legacy_plant_id) idMap.set(r.id, r.legacy_plant_id);
  });

  const allData: MonitorReadingDaily[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("monitor_readings_daily")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    const rows = (data || []) as unknown as Array<{
      id: string; tenant_id: string; plant_id: string; date: string;
      energy_kwh: number | null; peak_power_kw: number | null;
      metadata: Record<string, unknown> | null; created_at: string;
    }>;

    rows.forEach((r) => {
      allData.push({
        id: r.id,
        tenant_id: r.tenant_id,
        plant_id: idMap.get(r.plant_id) || r.plant_id, // Map to legacy ID for consumers
        date: r.date,
        energy_kwh: r.energy_kwh ?? 0,
        peak_power_kw: r.peak_power_kw,
        metadata: r.metadata || {},
        created_at: r.created_at,
      });
    });

    offset += BATCH_SIZE;
    hasMore = rows.length === BATCH_SIZE;
  }

  return allData;
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

/** Fetch today's metrics for all plants (v2: monitor_plants_with_metrics view) */
export async function getTodayMetrics(): Promise<SolarPlantMetricsDaily[]> {
  const today = getTodayBrasilia();
  const { data } = await supabase
    .from("monitor_plants_with_metrics")
    .select("id, legacy_plant_id, tenant_id, today_energy_kwh, today_peak_power_kw");

  return ((data as unknown as Array<{
    id: string; legacy_plant_id: string | null; tenant_id: string | null;
    today_energy_kwh: number | null; today_peak_power_kw: number | null;
  }>) || []).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id || "",
    plant_id: r.legacy_plant_id || r.id,
    date: today,
    energy_kwh: r.today_energy_kwh,
    power_kw: r.today_peak_power_kw,
    total_energy_kwh: null,
    metadata: {},
    created_at: "",
  }));
}

// ─── CLIENT LINKING ──────────────────────────────────────────

/**
 * @deprecated Legacy: writes directly to monitor_plants.client_id.
 * Canonical path is: UC.cliente_id → resolved via unit_plant_links.
 * Use resolveClienteFromPlant() from clienteResolution.ts for reads.
 * This function is kept for backward compatibility during migration.
 */
export async function updatePlantClientId(plantId: string, clientId: string | null): Promise<void> {
  // Resolve to monitor_plants row via legacy_plant_id
  const { data: mpRow } = await supabase
    .from("monitor_plants" as any)
    .select("id")
    .eq("legacy_plant_id", plantId)
    .maybeSingle();

  if (!mpRow) {
    // Also try direct id
    const { data: directRow } = await supabase
      .from("monitor_plants" as any)
      .select("id")
      .eq("id", plantId)
      .maybeSingle();
    if (!directRow) throw new Error("Usina não encontrada em monitor_plants");
    const { error } = await (supabase
      .from("monitor_plants" as any)
      .update({ client_id: clientId })
      .eq("id", plantId) as any);
    if (error) throw error;
    return;
  }

  const { error } = await (supabase
    .from("monitor_plants" as any)
    .update({ client_id: clientId })
    .eq("id", (mpRow as any).id) as any);
  if (error) throw error;
}

/**
 * @deprecated Legacy filter by monitor_plants.client_id.
 * Canonical: resolve via unit_plant_links → UC → cliente_id.
 */
export async function listPlantsByClientId(clientId: string): Promise<PlantWithHealth[]> {
  const all = await listPlantsWithHealth();
  return all.filter((p) => p.client_id === clientId);
}