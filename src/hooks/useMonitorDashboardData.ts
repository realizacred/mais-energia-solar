import { useQuery } from "@tanstack/react-query";
import { listAlerts, listAllReadings, listPlantsWithHealth, listIntegrations } from "@/services/monitoring/monitorService";
import { getFinancials, getPerformanceRatios } from "@/services/monitoring/monitorFinancialService";
import { isBrasiliaNight, getTodayBrasilia, getMonthStartBrasilia, getDaysAgoBrasilia } from "@/services/monitoring/plantStatusEngine";
import { addMinutes } from "date-fns";
import { useMemo } from "react";

const STALE = 1000 * 60 * 2; // 2 min — monitoring data changes frequently
const SYNC_INTERVAL_MIN = 15;
const REFRESH = 1000 * 30; // 30s — dashboard operacional precisa refletir sync recente

export function useMonitorDashboardData() {
  // Single source of truth — plants with health (no separate getDashboardStats call)
  const { data: plants = [], isLoading } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
    staleTime: STALE,
    refetchInterval: REFRESH,
  });

  // Derive stats directly from plants array — eliminates double fetch
  const stats = useMemo(() => {
    const plants_online = plants.filter(p => p.health?.status === "online").length;
    const plants_offline = plants.filter(p => p.health?.status === "offline").length;
    const plants_standby = plants.filter(p => p.health?.status === "standby").length;
    const plants_alert = plants.filter(p => (p.health?.open_alerts_count || 0) > 0).length;
    const plants_unknown = plants.filter(p => !p.health?.status || p.health.status === "unknown").length;
    const total_plants = plants.length;
    const energy_today_kwh = plants.reduce((s, p) => s + (p.health?.energy_today_kwh || 0), 0);
    const energy_month_kwh = plants.reduce((s, p) => s + (p.health?.energy_month_kwh || 0), 0);
    const current_power_kw = plants.reduce((s, p) => s + (p.health?.current_power_kw || 0), 0);

    return {
      plants_online,
      plants_offline,
      plants_standby,
      plants_alert,
      plants_unknown,
      total_plants,
      energy_today_kwh,
      energy_month_kwh,
      current_power_kw,
    };
  }, [plants]);

  const { data: openAlerts = [] } = useQuery({
    queryKey: ["monitor-alerts-open"],
    queryFn: () => listAlerts({ isOpen: true }),
    staleTime: STALE,
  });

  const todayBr = getTodayBrasilia();
  const thirtyDaysAgoStr = getDaysAgoBrasilia(30);
  const { data: readings = [] } = useQuery({
    queryKey: ["monitor-readings-30d"],
    queryFn: () => listAllReadings(thirtyDaysAgoStr, todayBr),
    staleTime: STALE,
  });

  const { data: financials } = useQuery({
    queryKey: ["monitor-financials", stats.energy_today_kwh, stats.energy_month_kwh],
    queryFn: () => getFinancials(stats.energy_today_kwh, stats.energy_month_kwh),
    enabled: stats.total_plants > 0,
    staleTime: STALE,
  });

  const monthStartStr = getMonthStartBrasilia();
  const yesterdayStr = getDaysAgoBrasilia(1);
  const prEndDate = yesterdayStr < monthStartStr ? monthStartStr : yesterdayStr;
  const { data: monthReadings = [] } = useQuery({
    queryKey: ["monitor-readings-month", prEndDate],
    queryFn: () => listAllReadings(monthStartStr, prEndDate),
    staleTime: STALE,
  });

  // Stable queryKey based on plant identity+status, not just count
  const prPlantsKey = useMemo(
    () => plants.map(p => p.id + (p.health?.status ?? "")).join(","),
    [plants]
  );

  const { data: prData = [] } = useQuery({
    queryKey: ["monitor-pr", prPlantsKey, monthReadings.length],
    queryFn: () => getPerformanceRatios(
      plants.map((p) => ({
        id: p.id, name: p.name, installed_power_kwp: p.installed_power_kwp,
        latitude: p.lat, longitude: p.lng,
      })),
      monthReadings
    ),
    enabled: plants.length > 0 && monthReadings.length > 0,
    staleTime: STALE,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["monitor-integrations"],
    queryFn: listIntegrations,
    staleTime: STALE,
  });

  // ─── Derived KPIs ───
  const totalPowerMwp = plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0) / 1000;
  const totalEnergyTodayMwh = stats.energy_today_kwh / 1000;
  const totalEnergyMonthMwh = stats.energy_month_kwh / 1000;
  const activeCount = stats.plants_online + stats.plants_standby;
  const activePerc = stats.total_plants ? ((activeCount / stats.total_plants) * 100).toFixed(0) : "0";
  const isNight = isBrasiliaNight();
  const alertCount = openAlerts.length;

  const validPr = prData.filter((p) => p.pr_status === "ok" && p.pr_percent != null);
  const avgPR = validPr.length > 0
    ? Math.round(validPr.reduce((s, p) => s + (p.pr_percent ?? 0), 0) / validPr.length * 10) / 10
    : null;

  const plantsWithCoords = plants.filter((p) => p.lat != null && p.lng != null);
  const avgLat = plantsWithCoords.length > 0
    ? plantsWithCoords.reduce((s, p) => s + (p.lat || 0), 0) / plantsWithCoords.length : null;
  const avgLng = plantsWithCoords.length > 0
    ? plantsWithCoords.reduce((s, p) => s + (p.lng || 0), 0) / plantsWithCoords.length : null;

  const isGenerating = stats.energy_today_kwh > 0;
  const isDaylight = !isBrasiliaNight();
  const realCurrentPower = isDaylight ? stats.current_power_kw : 0;

  const lastSyncDate = integrations
    .filter((i: any) => i.last_sync_at)
    .map((i: any) => new Date(i.last_sync_at).getTime())
    .sort((a: number, b: number) => b - a)[0];
  const lastSync = lastSyncDate ? new Date(lastSyncDate) : null;
  const nextSync = lastSync ? addMinutes(lastSync, SYNC_INTERVAL_MIN) : null;

  return {
    // Raw data
    stats,
    plants,
    openAlerts,
    readings,
    financials,
    prData,
    isLoading,
    // Derived KPIs
    totalPowerMwp,
    totalEnergyTodayMwh,
    totalEnergyMonthMwh,
    activeCount,
    activePerc,
    isNight,
    alertCount,
    avgPR,
    avgLat,
    avgLng,
    isGenerating,
    isDaylight,
    realCurrentPower,
    lastSync,
    nextSync,
  };
}
