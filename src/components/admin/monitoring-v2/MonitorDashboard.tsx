import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Sun, Zap, AlertTriangle, WifiOff, Activity, Database, Gauge, BatteryCharging, TrendingUp, Leaf } from "lucide-react";
import { toast } from "sonner";
import { getDashboardStats, listAlerts, listAllReadings, listPlantsWithHealth } from "@/services/monitoring/monitorService";
import { seedMonitorData, clearMonitorData } from "@/services/monitoring/mockSeedService";
import { useNavigate } from "react-router-dom";
import { MonitorStatusDonut } from "./charts/MonitorStatusDonut";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { cn } from "@/lib/utils";

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

  const seedMutation = useMutation({
    mutationFn: seedMonitorData,
    onSuccess: (res) => {
      toast.success(`Seed criado: ${res.plants} usinas, ${res.readings} leituras, ${res.events} eventos`);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearMutation = useMutation({
    mutationFn: clearMonitorData,
    onSuccess: () => {
      toast.success("Dados mock removidos");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <LoadingState message="Carregando dashboard..." />;

  const isEmpty = !stats || stats.total_plants === 0;

  // Compute aggregate KPIs
  const totalPowerMwp = plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0) / 1000;
  const totalEnergyTodayMwh = (stats?.energy_today_kwh || 0) / 1000;
  const totalEnergyMonthMwh = (stats?.energy_month_kwh || 0) / 1000;
  const onlinePerc = stats?.total_plants ? ((stats.plants_online / stats.total_plants) * 100).toFixed(0) : "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoramento Solar"
        description="Visão geral das usinas fotovoltaicas"
        icon={Sun}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Database className="h-3.5 w-3.5 mr-1" />
              {seedMutation.isPending ? "Criando..." : "Seed Demo"}
            </Button>
            {!isEmpty && (
              <Button size="sm" variant="ghost" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
                Limpar Mock
              </Button>
            )}
          </div>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina cadastrada"
          description="Conecte um provedor de monitoramento ou crie dados de demonstração para começar."
          action={{
            label: "Criar Dados Demo",
            onClick: () => seedMutation.mutate(),
            icon: Database,
          }}
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
            />
            <KpiCard
              label="Online"
              value={String(stats.plants_online)}
              subtitle={`${onlinePerc}%`}
              icon={Activity}
              color="success"
            />
            <KpiCard
              label="Com Alerta"
              value={String(stats.plants_alert)}
              icon={AlertTriangle}
              color="warning"
            />
            <KpiCard
              label="Offline"
              value={String(stats.plants_offline)}
              icon={WifiOff}
              color="destructive"
            />
            <KpiCard
              label="Potência Total"
              value={totalPowerMwp >= 1 ? `${totalPowerMwp.toFixed(1)} MWp` : `${(totalPowerMwp * 1000).toFixed(0)} kWp`}
              icon={Gauge}
              color="info"
            />
            <KpiCard
              label="Energia Hoje"
              value={totalEnergyTodayMwh >= 1 ? `${totalEnergyTodayMwh.toFixed(1)} MWh` : `${(stats.energy_today_kwh || 0).toFixed(0)} kWh`}
              icon={Zap}
              color="secondary"
            />
          </div>

          {/* Energy summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              label="Energia Mês"
              value={totalEnergyMonthMwh >= 1 ? `${totalEnergyMonthMwh.toFixed(1)} MWh` : `${(stats.energy_month_kwh || 0).toFixed(0)} kWh`}
              icon={TrendingUp}
              color="info"
            />
            <SummaryCard
              label="Alertas Abertos"
              value={String(openAlerts.filter(a => a.is_open).length)}
              icon={AlertTriangle}
              color="warning"
              subtitle={`${openAlerts.filter(a => a.severity === "critical").length} críticos`}
            />
            <SummaryCard
              label="Benefício Ambiental"
              value={`${((stats.energy_month_kwh || 0) * 0.084).toFixed(0)} kg CO₂`}
              icon={Leaf}
              color="success"
              subtitle="evitados este mês"
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

function KpiCard({ label, value, subtitle, icon: Icon, color }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: KpiColor;
}) {
  const s = KPI_STYLES[color];
  return (
    <div className={cn(
      "relative rounded-xl border border-border/60 bg-card p-4 ring-1 card-stat-elevated",
      s.ring
    )}>
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
