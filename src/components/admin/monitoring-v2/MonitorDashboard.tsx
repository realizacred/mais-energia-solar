import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Sun, Zap, AlertTriangle, WifiOff, Activity, Gauge,
  BatteryCharging, TrendingUp, Leaf, DollarSign, BarChart3,
  CloudSun, Wrench, Clock, RefreshCw, ChevronRight, CheckCircle2,
  Moon,
} from "lucide-react";
import { getDashboardStats, listAlerts, listAllReadings, listPlantsWithHealth, listIntegrations } from "@/services/monitoring/monitorService";
import { getFinancials, getPerformanceRatios } from "@/services/monitoring/monitorFinancialService";
import { isBrasiliaNight, getTodayBrasilia, getMonthStartBrasilia, getDaysAgoBrasilia } from "@/services/monitoring/plantStatusEngine";
import { useNavigate } from "react-router-dom";
import { MonitorStatusDonut } from "./charts/MonitorStatusDonut";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorGenerationVsEstimateChart } from "./charts/MonitorGenerationVsEstimateChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { EnergyFlowAnimation } from "./EnergyFlowAnimation";
import { WeatherWidget } from "./WeatherWidget";
import { MaintenanceCalendar } from "./MaintenanceCalendar";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/index";
import { formatDistanceToNow, addMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

const SYNC_INTERVAL_MIN = 15;

export default function MonitorDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["monitor-dashboard-stats"],
    queryFn: getDashboardStats,
    staleTime: 1000 * 30,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
    staleTime: 1000 * 30,
  });

  const { data: openAlerts = [] } = useQuery({
    queryKey: ["monitor-alerts-open"],
    queryFn: () => listAlerts({ isOpen: true }),
    staleTime: 1000 * 30,
  });

  const todayBr = getTodayBrasilia();
  const thirtyDaysAgoStr = getDaysAgoBrasilia(30);
  const { data: readings = [] } = useQuery({
    queryKey: ["monitor-readings-30d"],
    queryFn: () => listAllReadings(thirtyDaysAgoStr, todayBr),
    staleTime: 1000 * 30,
  });

  const { data: financials } = useQuery({
    queryKey: ["monitor-financials", stats?.energy_today_kwh, stats?.energy_month_kwh],
    queryFn: () => getFinancials(stats?.energy_today_kwh || 0, stats?.energy_month_kwh || 0),
    enabled: !!stats,
    staleTime: 1000 * 30,
  });

  const monthStartStr = getMonthStartBrasilia();
  const yesterdayStr = getDaysAgoBrasilia(1);
  const prEndDate = yesterdayStr < monthStartStr ? monthStartStr : yesterdayStr;
  const { data: monthReadings = [] } = useQuery({
    queryKey: ["monitor-readings-month", prEndDate],
    queryFn: () => listAllReadings(monthStartStr, prEndDate),
    staleTime: 1000 * 30,
  });

  const { data: prData = [] } = useQuery({
    queryKey: ["monitor-pr", plants.length, monthReadings.length],
    queryFn: () => getPerformanceRatios(
      plants.map((p) => ({
        id: p.id, name: p.name, installed_power_kwp: p.installed_power_kwp,
        latitude: p.lat, longitude: p.lng,
      })),
      monthReadings
    ),
    enabled: plants.length > 0 && monthReadings.length > 0,
    staleTime: 1000 * 30,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["monitor-integrations"],
    queryFn: listIntegrations,
    staleTime: 1000 * 30,
  });

  if (isLoading) return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-32" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );

  const isEmpty = !stats || stats.total_plants === 0;

  // ─── Derived KPIs ───
  const totalPowerMwp = plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0) / 1000;
  const totalEnergyTodayMwh = (stats?.energy_today_kwh || 0) / 1000;
  const totalEnergyMonthMwh = (stats?.energy_month_kwh || 0) / 1000;
  const activeCount = (stats?.plants_online || 0) + (stats?.plants_standby || 0);
  const activePerc = stats?.total_plants ? ((activeCount / stats.total_plants) * 100).toFixed(0) : "0";
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

  const isGenerating = (stats?.energy_today_kwh || 0) > 0;
  const isDaylight = !isBrasiliaNight();
  // SSOT: use real aggregated current_power_kw from health (not estimated)
  const realCurrentPower = isDaylight ? (stats?.current_power_kw || 0) : 0;

  const lastSyncDate = integrations
    .filter((i: any) => i.last_sync_at)
    .map((i: any) => new Date(i.last_sync_at).getTime())
    .sort((a: number, b: number) => b - a)[0];
  const lastSync = lastSyncDate ? new Date(lastSyncDate) : null;
  const nextSync = lastSync ? addMinutes(lastSync, SYNC_INTERVAL_MIN) : null;

  return (
    // width-exception: monitoring dashboard max-width for alignment
    <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 space-y-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <PageHeader
          title="Monitoramento Solar"
          description="Visão geral das usinas fotovoltaicas"
          icon={Sun}
        />
        {lastSync && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded-2xl px-3 py-2 border border-border/60 shrink-0">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync: <strong className="text-foreground">{formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}</strong></span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Próxima: <strong className="text-foreground">{nextSync && nextSync > new Date() ? nextSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "em breve"}</strong></span>
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState icon={Sun} title="Nenhuma usina cadastrada" description="Conecte um provedor de monitoramento para começar." />
      ) : (
        <>
          {/* ═══ KPI ROW — 4 columns top ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EnterpriseKpi
              icon={Sun} label="Total Usinas" value={String(stats.total_plants)}
              onClick={() => navigate("/admin/monitoramento/usinas")}
            />
            <EnterpriseKpi
              icon={isNight ? Moon : Activity}
              label={isNight ? "Ativas (Standby)" : "Online"}
              value={String(activeCount)}
              subtitle={`${activePerc}% do total`}
              accentColor="success"
              onClick={() => navigate(isNight ? "/admin/monitoramento/usinas?status=standby" : "/admin/monitoramento/usinas?status=online")}
            />
            <EnterpriseKpi
              icon={WifiOff} label="Offline"
              value={String(stats.plants_offline || 0)}
              accentColor={(stats.plants_offline || 0) > 0 ? "destructive" : "muted"}
              highlight={(stats.plants_offline || 0) > 0}
              onClick={() => navigate("/admin/monitoramento/usinas?status=offline")}
            />
            <EnterpriseKpi
              icon={Moon} label="Standby"
              value={String(stats.plants_standby || 0)}
              accentColor={(stats.plants_standby || 0) > 0 ? "warning" : "muted"}
              onClick={() => navigate("/admin/monitoramento/usinas?status=standby")}
            />
          </div>

          {/* ═══ KPI ROW 2 — metrics ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EnterpriseKpi
              icon={AlertTriangle} label="Com Alerta"
              value={String(alertCount)}
              accentColor={alertCount > 0 ? "destructive" : "muted"}
              highlight={alertCount > 0}
              onClick={() => navigate("/admin/monitoramento/alertas")}
            />
            <EnterpriseKpi
              icon={Gauge} label="Potência Instalada"
              value={totalPowerMwp >= 1 ? `${totalPowerMwp.toFixed(1)} MWp` : `${(totalPowerMwp * 1000).toFixed(0)} kWp`}
            />
            <EnterpriseKpi
              icon={Zap} label="Energia Hoje"
              value={totalEnergyTodayMwh >= 1 ? `${totalEnergyTodayMwh.toFixed(1)} MWh` : `${(stats.energy_today_kwh || 0).toFixed(0)} kWh`}
              accentColor="primary"
            />
            <EnterpriseKpi
              icon={BatteryCharging} label="Energia do Mês"
              value={totalEnergyMonthMwh >= 1 ? `${totalEnergyMonthMwh.toFixed(1)} MWh` : `${(stats.energy_month_kwh || 0).toFixed(0)} kWh`}
              accentColor="secondary"
            />
          </div>

          {/* ═══ PRIORITY ALERT ═══ */}
          <PriorityAlertBlock alerts={openAlerts} onViewAlerts={() => navigate("/admin/monitoramento/alertas")} />

          {/* ═══ OFFLINE + STANDBY LISTS ═══ */}
          <OfflineStandbySection plants={plants} navigate={navigate} />
          {/* ═══ 2-COL: Energy Flow + Weather ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <SectionCard title="Fluxo de Energia" icon={Zap} variant="blue">
              <EnergyFlowAnimation
                currentPowerKw={realCurrentPower}
                isGenerating={isDaylight && isGenerating}
              />
            </SectionCard>

            {avgLat && avgLng ? (
              <SectionCard title="Previsão do Tempo" icon={CloudSun}>
                <WeatherWidget lat={avgLat} lng={avgLng} />
              </SectionCard>
            ) : (
              <SectionCard title="Previsão do Tempo" icon={CloudSun}>
                <p className="text-sm text-muted-foreground text-center py-6">
                  Adicione coordenadas às usinas para ver o clima.
                </p>
              </SectionCard>
            )}
          </div>

          {/* ═══ GERAÇÃO 30 DIAS (full width) ═══ */}
          <SectionCard title="Geração — Últimos 30 dias" icon={BatteryCharging} variant="blue">
            <MonitorGenerationChart readings={readings} />
          </SectionCard>

          {/* ═══ 2-COL: Real vs Projetada + Status/Resumo ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <SectionCard title="Geração Real vs Projetada" icon={BarChart3} variant="blue">
              <MonitorGenerationVsEstimateChart
                readings={readings}
                plants={plants.map((p) => ({ id: p.id, name: p.name, installed_power_kwp: p.installed_power_kwp }))}
                hspKwhM2={prData?.[0]?.hsp_used ?? null}
              />
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="Status das Usinas" icon={Activity}>
                <MonitorStatusDonut stats={stats} />
              </SectionCard>

              <OperationalSummary
                onlinePerc={Number(activePerc)}
                alertCount={alertCount}
                currentPowerKw={realCurrentPower}
                energyTodayKwh={stats.energy_today_kwh || 0}
                standbyCount={stats.plants_standby || 0}
                offlineCount={stats.plants_offline || 0}
                avgPR={avgPR}
                financials={financials}
              />
            </div>
          </div>

          {/* ═══ MAINTENANCE ═══ */}
          {prData.length > 0 && (
            <SectionCard title="Manutenção & Limpeza" icon={Wrench} variant="warning">
              <MaintenanceCalendar prData={prData} plants={plants} />
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ENTERPRISE KPI CARD
═══════════════════════════════════════════════════════════════ */

type AccentColor = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const ACCENT_MAP: Record<AccentColor, { iconBg: string; iconText: string; borderHighlight: string }> = {
  primary:     { iconBg: "bg-primary/15",     iconText: "text-primary",         borderHighlight: "border-primary/30" },
  secondary:   { iconBg: "bg-secondary/15",   iconText: "text-secondary",       borderHighlight: "border-secondary/30" },
  success:     { iconBg: "bg-success/15",     iconText: "text-success",         borderHighlight: "border-success/30" },
  warning:     { iconBg: "bg-warning/15",     iconText: "text-warning",         borderHighlight: "border-warning/30" },
  destructive: { iconBg: "bg-destructive/15", iconText: "text-destructive",     borderHighlight: "border-destructive/40" },
  info:        { iconBg: "bg-info/15",        iconText: "text-info",            borderHighlight: "border-info/30" },
  muted:       { iconBg: "bg-muted",          iconText: "text-muted-foreground", borderHighlight: "border-border" },
};

function EnterpriseKpi({ icon: Icon, label, value, subtitle, accentColor = "muted", highlight = false, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: AccentColor;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const a = ACCENT_MAP[accentColor];
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border bg-card p-6 transition-all duration-200 shadow-sm",
        highlight ? a.borderHighlight : "border-border/50",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium min-h-[28px] leading-[14px] flex items-end">{label}</p>
          <p className="text-2xl font-bold text-foreground leading-none mt-1">{value}</p>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p>
          ) : (
            <div className="h-[17px]" />
          )}
        </div>
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", a.iconBg)}>
          <Icon className={cn("h-[18px] w-[18px]", a.iconText)} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRIORITY ALERT BLOCK
═══════════════════════════════════════════════════════════════ */

function PriorityAlertBlock({ alerts, onViewAlerts }: {
  alerts: Array<{ id: string; title: string; severity: string; plant_id: string }>;
  onViewAlerts: () => void;
}) {
  const criticals = alerts.filter((a) => a.severity === "critical");
  const hasCritical = criticals.length > 0;

  if (!hasCritical && alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/5 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <p className="text-sm font-medium text-foreground">Sistema operando dentro da normalidade</p>
      </div>
    );
  }

  const topAlert = criticals[0] || alerts[0];

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4",
      hasCritical
        ? "border-destructive/25 bg-gradient-to-r from-destructive/5 via-destructive/3 to-transparent"
        : "border-warning/25 bg-gradient-to-r from-warning/5 via-warning/3 to-transparent"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          hasCritical ? "bg-destructive/10" : "bg-warning/10"
        )}>
          <AlertTriangle className={cn("h-4 w-4", hasCritical ? "text-destructive" : "text-warning")} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{topAlert.title}</p>
          <p className="text-xs text-muted-foreground">
            {alerts.length === 1 ? "1 alerta ativo" : `${alerts.length} alertas ativos`}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onViewAlerts} className="shrink-0 gap-1">
        Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OPERATIONAL SUMMARY
═══════════════════════════════════════════════════════════════ */

function OperationalSummary({ onlinePerc, alertCount, currentPowerKw, energyTodayKwh, standbyCount, offlineCount, avgPR, financials }: {
  onlinePerc: number;
  alertCount: number;
  currentPowerKw: number;
  energyTodayKwh: number;
  standbyCount: number;
  offlineCount: number;
  avgPR: number | null;
  financials: any;
}) {
  const rows = [
    { label: "Disponibilidade", value: `${onlinePerc}%`, icon: Activity, color: onlinePerc >= 90 ? "text-success" : onlinePerc >= 70 ? "text-warning" : "text-destructive" },
    { label: "Standby", value: String(standbyCount), icon: Moon, color: "text-warning" },
    { label: "Offline", value: String(offlineCount), icon: WifiOff, color: offlineCount > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Alertas ativos", value: String(alertCount), icon: AlertTriangle, color: alertCount > 0 ? "text-destructive" : "text-success" },
    { label: "Potência ativa", value: currentPowerKw > 0 ? `${(currentPowerKw).toFixed(0)} kW` : "—", icon: Zap, color: "text-primary" },
    { label: "Energia acumulada hoje", value: `${energyTodayKwh.toFixed(0)} kWh`, icon: BatteryCharging, color: "text-secondary" },
    ...(avgPR !== null ? [{ label: "Performance Ratio", value: `${avgPR}%`, icon: BarChart3, color: avgPR >= 75 ? "text-success" : avgPR >= 60 ? "text-warning" : "text-destructive" }] : []),
    ...(financials ? [
      { label: "Economia hoje", value: formatBRL(financials.savings_today_brl), icon: DollarSign, color: "text-success" },
      { label: "Economia mês", value: formatBRL(financials.savings_month_brl), icon: TrendingUp, color: "text-info" },
      { label: "CO₂ evitado", value: `${financials.co2_avoided_month_kg.toFixed(0)} kg`, icon: Leaf, color: "text-success" },
    ] : []),
  ];

  return (
    <SectionCard title="Resumo Operacional" icon={BarChart3}>
      <div className="space-y-0 divide-y divide-border/40">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <row.icon className={cn("h-3.5 w-3.5", row.color)} />
              <span>{row.label}</span>
            </div>
            <span className={cn("text-sm font-semibold", row.color)}>{row.value}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OFFLINE / STANDBY QUICK LIST
═══════════════════════════════════════════════════════════════ */

function OfflineStandbySection({ plants, navigate }: {
  plants: Array<{ id: string; name: string; health?: { status?: string; last_seen_at?: string | null } }>;
  navigate: (path: string) => void;
}) {
  const offlinePlants = plants.filter((p) => p.health?.status === "offline");
  const standbyPlants = plants.filter((p) => p.health?.status === "standby");

  if (offlinePlants.length === 0 && standbyPlants.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {offlinePlants.length > 0 && (
        <SectionCard title={`Offline (${offlinePlants.length})`} icon={WifiOff} variant="warning">
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {offlinePlants.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm text-foreground truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-xs text-muted-foreground">
                    {p.health?.last_seen_at
                      ? formatDistanceToNow(new Date(p.health.last_seen_at), { addSuffix: true, locale: ptBR })
                      : "sem dados"}
                  </span>
                </div>
              </button>
            ))}
            {offlinePlants.length > 20 && (
              <button onClick={() => navigate("/admin/monitoramento/usinas?status=offline")} className="w-full text-xs text-primary font-medium py-2 hover:underline">
                Ver todas ({offlinePlants.length})
              </button>
            )}
          </div>
        </SectionCard>
      )}
      {standbyPlants.length > 0 && (
        <SectionCard title={`Standby (${standbyPlants.length})`} icon={Moon}>
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {standbyPlants.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/monitoramento/usinas/${p.id}`)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-sm text-foreground truncate">{p.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-warning" />
                  <span className="text-xs text-muted-foreground">standby</span>
                </div>
              </button>
            ))}
            {standbyPlants.length > 20 && (
              <button onClick={() => navigate("/admin/monitoramento/usinas?status=standby")} className="w-full text-xs text-primary font-medium py-2 hover:underline">
                Ver todas ({standbyPlants.length})
              </button>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
