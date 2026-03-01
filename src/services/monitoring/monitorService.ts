/**
 * Monitor Service — canonical data access layer for monitor_* tables.
 * Never access tables directly from components.
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
