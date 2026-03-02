import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Sun, Zap, AlertTriangle, WifiOff, Activity, Gauge, BatteryCharging, TrendingUp, Leaf, DollarSign, BarChart3, CloudSun, Wrench } from "lucide-react";
import { toast } from "sonner";
import { getDashboardStats, listAlerts, listAllReadings, listPlantsWithHealth } from "@/services/monitoring/monitorService";
import { getFinancials, getPerformanceRatios } from "@/services/monitoring/monitorFinancialService";
import { useNavigate } from "react-router-dom";
import { MonitorStatusDonut } from "./charts/MonitorStatusDonut";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorGenerationVsEstimateChart } from "./charts/MonitorGenerationVsEstimateChart";
import { MonitorPRChart } from "./charts/MonitorPRChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { EnergyFlowAnimation } from "./EnergyFlowAnimation";
import { WeatherWidget } from "./WeatherWidget";
import { MaintenanceCalendar } from "./MaintenanceCalendar";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/index";

export default function MonitorDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ["monitor-dashboard-stats"],
    queryFn: getDashboardStats,
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
  });

  const { data: openAlerts = [] } = useQuery({
    queryKey: ["monitor-alerts-open"],
    queryFn: () => listAlerts({ isOpen: true }),
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: readings = [] } = useQuery({
    queryKey: ["monitor-readings-30d"],
    queryFn: () => listAllReadings(thirtyDaysAgo.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
  });

  // Financial data
  const { data: financials } = useQuery({
    queryKey: ["monitor-financials", stats?.energy_today_kwh, stats?.energy_month_kwh],
    queryFn: () => getFinancials(stats?.energy_today_kwh || 0, stats?.energy_month_kwh || 0),
    enabled: !!stats,
  });

  // Monthly readings for PR calculation
  const monthStart = new Date();
  monthStart.setDate(1);
  const { data: monthReadings = [] } = useQuery({
    queryKey: ["monitor-readings-month"],
    queryFn: () => listAllReadings(monthStart.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
  });

  // Performance Ratio
  const { data: prData = [] } = useQuery({
    queryKey: ["monitor-pr", plants.length, monthReadings.length],
    queryFn: () => getPerformanceRatios(
      plants.map((p) => ({
        id: p.id,
        name: p.name,
        installed_power_kwp: p.installed_power_kwp,
        latitude: p.lat,
        longitude: p.lng,
      })),
      monthReadings
    ),
    enabled: plants.length > 0 && monthReadings.length > 0,
  });


  if (isLoading) return <LoadingState message="Carregando dashboard..." />;

  const isEmpty = !stats || stats.total_plants === 0;

  // Compute aggregate KPIs
  const totalPowerMwp = plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0) / 1000;
  const totalEnergyTodayMwh = (stats?.energy_today_kwh || 0) / 1000;
  const totalEnergyMonthMwh = (stats?.energy_month_kwh || 0) / 1000;
  const onlinePerc = stats?.total_plants ? ((stats.plants_online / stats.total_plants) * 100).toFixed(0) : "0";

  // PR average (only plants with valid PR)
  const validPr = prData.filter((p) => p.pr_status === "ok" && p.pr_percent != null);
  const avgPR = validPr.length > 0
    ? Math.round(validPr.reduce((s, p) => s + (p.pr_percent ?? 0), 0) / validPr.length * 10) / 10
    : null;

  // Average lat/lng for weather widget
  const plantsWithCoords = plants.filter((p) => p.lat != null && p.lng != null);
  const avgLat = plantsWithCoords.length > 0
    ? plantsWithCoords.reduce((s, p) => s + (p.lat || 0), 0) / plantsWithCoords.length
    : null;
  const avgLng = plantsWithCoords.length > 0
    ? plantsWithCoords.reduce((s, p) => s + (p.lng || 0), 0) / plantsWithCoords.length
    : null;

  // Current power estimate (if generating today)
  const isGenerating = (stats?.energy_today_kwh || 0) > 0;
  const currentHour = new Date().getHours();
  const isDaylight = currentHour >= 6 && currentHour <= 18;
  const estimatedCurrentPower = isDaylight && isGenerating
    ? (plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0) * 0.7)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoramento Solar"
        description="Visão geral das usinas fotovoltaicas"
        icon={Sun}
      />

      {isEmpty ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina cadastrada"
          description="Conecte um provedor de monitoramento para começar."
        />
      ) : (
        <>
          {/* Hero KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              label="Total Usinas"
              value={String(stats.total_plants)}
              icon={Sun}
              color="primary"
              onClick={() => navigate("/admin/monitoramento/usinas")}
            />
            <KpiCard
              label="Online"
              value={String(stats.plants_online)}
              subtitle={`${onlinePerc}%`}
              icon={Activity}
              color="success"
              onClick={() => navigate("/admin/monitoramento/usinas?status=online")}
            />
            <KpiCard
              label="Com Alerta"
              value={String(stats.plants_alert)}
              icon={AlertTriangle}
              color="warning"
              onClick={() => navigate("/admin/monitoramento/usinas?status=alert")}
            />
            <KpiCard
              label="Offline"
              value={String(stats.plants_offline)}
              icon={WifiOff}
              color="destructive"
              onClick={() => navigate("/admin/monitoramento/usinas?status=offline")}
            />
            <KpiCard
              label="Potência Total"
              value={totalPowerMwp >= 1 ? `${totalPowerMwp.toFixed(1)} MWp` : `${(totalPowerMwp * 1000).toFixed(0)} kWp`}
              icon={Gauge}
              color="info"
              onClick={() => navigate("/admin/monitoramento/usinas")}
            />
            <KpiCard
              label="Energia Hoje"
              value={totalEnergyTodayMwh >= 1 ? `${totalEnergyTodayMwh.toFixed(1)} MWh` : `${(stats.energy_today_kwh || 0).toFixed(0)} kWh`}
              icon={Zap}
              color="secondary"
              onClick={() => navigate("/admin/monitoramento/usinas")}
            />
          </div>

          {/* Financial + Environmental + PR summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Economia Hoje"
              value={financials ? formatBRL(financials.savings_today_brl) : "—"}
              icon={DollarSign}
              color="success"
              subtitle={financials ? `Tarifa: ${formatBRL(financials.tarifa_kwh)}/kWh` : undefined}
            />
            <SummaryCard
              label="Economia Mês"
              value={financials ? formatBRL(financials.savings_month_brl) : "—"}
              icon={TrendingUp}
              color="info"
              subtitle={totalEnergyMonthMwh >= 1 ? `${totalEnergyMonthMwh.toFixed(1)} MWh gerados` : `${(stats.energy_month_kwh || 0).toFixed(0)} kWh gerados`}
            />
            <SummaryCard
              label="CO₂ Evitado (Mês)"
              value={financials ? `${financials.co2_avoided_month_kg.toFixed(0)} kg` : "—"}
              icon={Leaf}
              color="success"
              subtitle={financials ? `≈ ${Math.ceil(financials.co2_avoided_month_kg / 22)} árvores/ano` : undefined}
            />
            <SummaryCard
              label="Performance Ratio"
              value={avgPR !== null ? `${avgPR}%` : "—"}
              icon={BarChart3}
              color={avgPR !== null && avgPR >= 75 ? "success" : avgPR !== null && avgPR >= 60 ? "warning" : "destructive"}
              subtitle={avgPR !== null ? (avgPR >= 80 ? "Excelente" : avgPR >= 70 ? "Bom" : avgPR >= 60 ? "Regular" : "Atenção") : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Attention list */}
            <SectionCard title="Atenção Agora" icon={AlertTriangle} variant="warning" className="lg:col-span-2">
              <MonitorAttentionList
                alerts={openAlerts.slice(0, 10)}
                onViewPlant={(plantId) => navigate(`/admin/monitoramento/usinas/${plantId}`)}
              />
            </SectionCard>

            {/* Status donut */}
            <SectionCard title="Status das Usinas" icon={Activity}>
              <MonitorStatusDonut stats={stats} />
            </SectionCard>
          </div>

          {/* Generation chart */}
          <SectionCard title="Geração — Últimos 30 dias" icon={BatteryCharging} variant="blue">
            <MonitorGenerationChart readings={readings} />
          </SectionCard>

          {/* Energy Flow Animation + Weather */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Fluxo de Energia" icon={Zap} variant="blue">
              <EnergyFlowAnimation
                currentPowerKw={estimatedCurrentPower}
                isGenerating={isDaylight && isGenerating}
              />
            </SectionCard>

            {avgLat && avgLng ? (
              <SectionCard title="Previsão do Tempo" icon={CloudSun}>
                <WeatherWidget lat={avgLat} lng={avgLng} />
              </SectionCard>
            ) : (
              <SectionCard title="Previsão do Tempo" icon={CloudSun}>
                <p className="text-sm text-muted-foreground text-center py-8">
                  Adicione coordenadas às usinas para ver o clima.
                </p>
              </SectionCard>
            )}
          </div>

          {/* Generation vs Estimate chart */}
          <SectionCard title="Geração Real vs Projetada — Últimos 30 dias" icon={BarChart3} variant="blue">
            <MonitorGenerationVsEstimateChart
              readings={readings}
              plants={plants.map((p) => ({ id: p.id, name: p.name, installed_power_kwp: p.installed_power_kwp }))}
            />
          </SectionCard>

          {/* Maintenance / Cleaning Calendar */}
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

/* ─── Inline KPI Card ─── */
type KpiColor = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const KPI_STYLES: Record<KpiColor, { ring: string; iconBg: string; iconText: string }> = {
  primary:     { ring: "ring-primary/20",     iconBg: "bg-primary/10",     iconText: "text-primary" },
  secondary:   { ring: "ring-secondary/20",   iconBg: "bg-secondary/10",   iconText: "text-secondary" },
  success:     { ring: "ring-success/20",     iconBg: "bg-success/10",     iconText: "text-success" },
  warning:     { ring: "ring-warning/20",     iconBg: "bg-warning/10",     iconText: "text-warning" },
  destructive: { ring: "ring-destructive/20", iconBg: "bg-destructive/10", iconText: "text-destructive" },
  info:        { ring: "ring-info/20",        iconBg: "bg-info/10",        iconText: "text-info" },
  muted:       { ring: "ring-muted/30",       iconBg: "bg-muted",          iconText: "text-muted-foreground" },
};

function KpiCard({ label, value, subtitle, icon: Icon, color, onClick }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: KpiColor;
  onClick?: () => void;
}) {
  const s = KPI_STYLES[color];
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border border-border/60 bg-card p-4 ring-1 card-stat-elevated",
        s.ring,
        onClick && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-xl font-bold text-foreground mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </div>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.iconBg)}>
          <Icon className={cn("h-4.5 w-4.5", s.iconText)} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subtitle, icon: Icon, color }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: KpiColor;
}) {
  const s = KPI_STYLES[color];
  return (
    <div className={cn(
      "flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 ring-1 card-stat-elevated",
      s.ring
    )}>
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", s.iconBg)}>
        <Icon className={cn("h-5 w-5", s.iconText)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-lg font-bold text-foreground truncate">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
      </div>
    </div>
  );
}
