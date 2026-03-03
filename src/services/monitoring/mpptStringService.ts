/**
 * MPPT/String Service — SSOT for string-level monitoring data access.
 * Reads from monitor_string_registry, monitor_string_metrics, monitor_string_alerts.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/storagePaths";
import { normalizeDeviceToStringReadings } from "./mpptStringNormalizer";
import type {
  StringRegistry,
  StringMetric,
  StringAlert,
  StringRegistryWithMetric,
  DeviceStringCard,
} from "./mpptStringTypes";
import type { MonitorDevice } from "./monitorTypes";

// ─── Feature flag check ──────────────────────────────────────

export async function isMpptStringEnabled(): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;

  const { data } = await supabase
    .from("tenants" as any)
    .select("tenant_config")
    .eq("id", tenantId)
    .maybeSingle();

  const config = (data as any)?.tenant_config;
  return config?.feature_mppt_string_monitoring === true;
}

// ─── ID Resolution helper ────────────────────────────────────

/** Resolve a plantId (which may be solar_plants.id) to monitor_plants.id */
async function resolveMonitorPlantId(plantId: string): Promise<string> {
  // First check if plantId is already a monitor_plants.id
  const { data: directCheck } = await supabase
    .from("monitor_plants" as any)
    .select("id")
    .eq("id", plantId)
    .maybeSingle();
  if (directCheck) return plantId;

  // Fallback: plantId is a legacy solar_plants.id
  const { data: monitorPlant } = await supabase
    .from("monitor_plants" as any)
    .select("id")
    .eq("legacy_plant_id", plantId)
    .maybeSingle();
  return (monitorPlant as any)?.id || plantId;
}

// ─── Registry ────────────────────────────────────────────────

export async function listStringRegistry(plantId: string): Promise<StringRegistry[]> {
  const resolvedId = await resolveMonitorPlantId(plantId);
  const { data } = await supabase
    .from("monitor_string_registry" as any)
    .select("*")
    .eq("plant_id", resolvedId)
    .eq("is_active", true)
    .order("device_id")
    .order("mppt_number")
    .order("string_number");
  return (data as unknown as StringRegistry[]) || [];
}

export async function listStringRegistryByDevice(deviceId: string): Promise<StringRegistry[]> {
  const { data } = await supabase
    .from("monitor_string_registry" as any)
    .select("*")
    .eq("device_id", deviceId)
    .eq("is_active", true)
    .order("mppt_number")
    .order("string_number");
  return (data as unknown as StringRegistry[]) || [];
}

// ─── Metrics ─────────────────────────────────────────────────

export async function listLatestMetrics(registryIds: string[]): Promise<StringMetric[]> {
  if (!registryIds.length) return [];

  // Get the latest metric for each registry entry
  const { data } = await supabase
    .from("monitor_string_metrics" as any)
    .select("*")
    .in("registry_id", registryIds)
    .order("ts", { ascending: false })
    .limit(registryIds.length * 2);

  // Deduplicate: keep only the latest per registry_id
  const seen = new Set<string>();
  const result: StringMetric[] = [];
  for (const row of (data as unknown as StringMetric[]) || []) {
    if (!seen.has(row.registry_id)) {
      seen.add(row.registry_id);
      result.push(row);
    }
  }
  return result;
}

export async function listMetricsHistory(
  registryId: string,
  startDate: string,
  endDate: string,
): Promise<StringMetric[]> {
  const { data } = await supabase
    .from("monitor_string_metrics" as any)
    .select("*")
    .eq("registry_id", registryId)
    .gte("ts", startDate)
    .lte("ts", endDate)
    .order("ts", { ascending: true });
  return (data as unknown as StringMetric[]) || [];
}

// ─── Alerts ──────────────────────────────────────────────────

export async function listStringAlerts(filters?: {
  plantId?: string;
  deviceId?: string;
  status?: string;
}): Promise<StringAlert[]> {
  let resolvedPlantId = filters?.plantId;
  if (resolvedPlantId) {
    resolvedPlantId = await resolveMonitorPlantId(resolvedPlantId);
  }

  let q = supabase
    .from("monitor_string_alerts" as any)
    .select("*")
    .order("detected_at", { ascending: false });

  if (resolvedPlantId) q = q.eq("plant_id", resolvedPlantId);
  if (filters?.deviceId) q = q.eq("device_id", filters.deviceId);
  if (filters?.status) q = q.eq("status", filters.status);

  const { data } = await q.limit(200);
  return (data as unknown as StringAlert[]) || [];
}

// ─── Enriched view: registry + latest metrics + alert status ─

export async function getDeviceStringCards(
  plantId: string,
  devices: MonitorDevice[],
): Promise<DeviceStringCard[]> {
  const inverters = devices.filter((d) => d.type === "inverter");
  console.log("[getDeviceStringCards] plantId:", plantId, "total devices:", devices.length, "inverters:", inverters.length);
  console.log("[getDeviceStringCards] device types:", devices.map(d => ({ id: d.id, type: d.type, model: d.model })));
  if (!inverters.length) return [];

  const registry = await listStringRegistry(plantId);
  console.log("[getDeviceStringCards] registry entries:", registry.length);
  const registryIds = registry.map((r) => r.id);
  const [latestMetrics, openAlerts] = await Promise.all([
    listLatestMetrics(registryIds),
    listStringAlerts({ plantId, status: "open" }),
  ]);

  const metricsMap = new Map(latestMetrics.map((m) => [m.registry_id, m]));
  const alertsByDevice = new Map<string, StringAlert[]>();
  for (const a of openAlerts) {
    const arr = alertsByDevice.get(a.device_id) || [];
    arr.push(a);
    alertsByDevice.set(a.device_id, arr);
  }

  return inverters.map((dev) => {
    const devRegistry = registry.filter((r) => r.device_id === dev.id);

    // ── Fallback: if no registry entries, use normalizer to extract from metadata ──
    if (devRegistry.length === 0) {
      console.log("[getDeviceStringCards] No registry for device", dev.id, "- using normalizer fallback. metadata keys:", Object.keys(dev.metadata || {}));
      const readings = normalizeDeviceToStringReadings(dev, plantId, true);
      console.log("[getDeviceStringCards] Normalizer fallback produced", readings.length, "readings for device", dev.id);
      const fallbackStrings: StringRegistryWithMetric[] = readings.map((r) => ({
        id: `live-${dev.id}-${r.mppt_number ?? 0}-${r.string_number ?? 0}`,
        tenant_id: r.tenant_id,
        plant_id: r.plant_id,
        device_id: r.device_id,
        inverter_serial: r.inverter_serial,
        provider_id: r.provider_id,
        mppt_number: r.mppt_number,
        string_number: r.string_number,
        granularity: r.granularity,
        first_seen_at: r.ts,
        last_seen_at: r.ts,
        baseline_day: null,
        baseline_power_p50_w: null,
        baseline_power_avg_w: null,
        baseline_power_p90_w: null,
        is_active: true,
        metadata: {},
        created_at: r.ts,
        updated_at: r.ts,
        latest_power_w: r.power_w,
        latest_voltage_v: r.voltage_v,
        latest_current_a: r.current_a,
        latest_ts: r.ts,
        baseline_pct: null,
        alert_status: r.power_w != null && r.power_w > 0 ? "ok"
          : r.power_w === 0 && r.inverter_online ? "critical"
          : "unknown",
      }));

      return {
        device_id: dev.id,
        device_model: dev.model,
        device_serial: dev.serial,
        device_status: dev.status,
        strings: fallbackStrings,
        open_alerts: alertsByDevice.get(dev.id) || [],
      };
    }

    const strings: StringRegistryWithMetric[] = devRegistry.map((reg) => {
      const metric = metricsMap.get(reg.id);
      const baselinePct =
        reg.baseline_power_p50_w && metric?.power_w != null
          ? (metric.power_w / reg.baseline_power_p50_w) * 100
          : null;

      let alertStatus: "ok" | "warn" | "critical" | "unknown" = "unknown";
      if (metric && metric.power_w != null) {
        if (metric.power_w === 0 && metric.online) alertStatus = "critical";
        else if (baselinePct !== null && baselinePct < 30) alertStatus = "warn";
        else if (metric.power_w > 0) alertStatus = "ok";
      }

      return {
        ...reg,
        latest_power_w: metric?.power_w ?? null,
        latest_voltage_v: metric?.voltage_v ?? null,
        latest_current_a: metric?.current_a ?? null,
        latest_ts: metric?.ts ?? null,
        baseline_pct: baselinePct,
        alert_status: alertStatus,
      };
    });

    return {
      device_id: dev.id,
      device_model: dev.model,
      device_serial: dev.serial,
      device_status: dev.status,
      strings,
      open_alerts: alertsByDevice.get(dev.id) || [],
    };
  });
}

// ─── Baseline recalculation (manual trigger) ─────────────────

export async function recalculateBaseline(plantId: string): Promise<{ updated: number }> {
  const resolvedId = await resolveMonitorPlantId(plantId);
  try {
    const { data, error } = await supabase.functions.invoke("mppt-string-engine", {
      body: { action: "recalculate_baseline", plant_id: resolvedId },
    });
    if (error) {
      // FunctionsHttpError: try to extract the response body for details
      let msg = "Erro ao recalcular baseline";
      try {
        if (error instanceof Response || (error as any)?.json) {
          const body = await (error as any).json();
          msg = body?.error || body?.message || msg;
        } else if (typeof error === "object" && "message" in error) {
          msg = (error as any).message || msg;
        } else {
          msg = String(error);
        }
      } catch {
        msg = typeof error === "object" && "message" in error
          ? (error as any).message
          : String(error);
      }
      console.error("[recalculateBaseline] Edge function error:", msg);
      throw new Error(msg);
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return { updated: data?.updated || 0 };
  } catch (e: any) {
    if (e?.message) throw e;
    console.error("[recalculateBaseline] Unexpected error:", e);
    throw new Error("Erro inesperado ao recalcular baseline");
  }
}

// ─── Bootstrap all plants (initial setup) ────────────────────

export async function bootstrapAllStrings(): Promise<{ processed: number; plants: number }> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("Tenant não encontrado");

  const { data, error } = await supabase.functions.invoke("mppt-string-engine", {
    body: { action: "bootstrap_all", tenant_id: tenantId },
  });

  if (error) {
    let msg = "Erro ao inicializar strings";
    try {
      if (typeof error === "object" && "message" in error) {
        msg = (error as any).message || msg;
      }
    } catch {}
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  return { processed: data?.processed || 0, plants: data?.plants || 0 };
}
