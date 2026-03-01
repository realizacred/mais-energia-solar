import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Sun, Zap, AlertTriangle, WifiOff, Activity, Battery, Database, Gauge, BarChart3, BatteryCharging } from "lucide-react";
import { toast } from "sonner";
import { getDashboardStats, listAlerts, listAllReadings, listPlantsWithHealth } from "@/services/monitoring/monitorService";
import { seedMonitorData, clearMonitorData } from "@/services/monitoring/mockSeedService";
import { useNavigate } from "react-router-dom";
import { MonitorStatusDonut } from "./charts/MonitorStatusDonut";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";

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
          {/* Hero KPIs — inspired by SolarZ/SolarView */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
              label="Total de Usinas"
              value={stats.total_plants}
              icon={Sun}
              color="primary"
            />
            <StatCard
              label="Usinas Online"
              value={stats.plants_online}
              icon={Activity}
              color="success"
              subtitle={`${stats.total_plants ? ((stats.plants_online / stats.total_plants) * 100).toFixed(0) : 0}%`}
            />
            <StatCard
              label="Com Alerta"
              value={stats.plants_alert}
              icon={AlertTriangle}
              color="warning"
            />
            <StatCard
              label="Offline"
              value={stats.plants_offline}
              icon={WifiOff}
              color="destructive"
            />
            <StatCard
              label="Potência Instalada"
              value={totalPowerMwp >= 1 ? `${totalPowerMwp.toFixed(2)} MWp` : `${(totalPowerMwp * 1000).toFixed(0)} kWp`}
              icon={Gauge}
              color="info"
            />
            <StatCard
              label="Energia Hoje"
              value={totalEnergyTodayMwh >= 1 ? `${totalEnergyTodayMwh.toFixed(1)} MWh` : `${(stats.energy_today_kwh || 0).toFixed(0)} kWh`}
              icon={Zap}
              color="secondary"
            />
          </div>

          {/* Tickets / Alertas resumo — inspired by SolarZ */}
          {openAlerts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Alertas Abertos"
                value={openAlerts.filter(a => a.is_open).length}
                icon={AlertTriangle}
                color="warning"
              />
              <StatCard
                label="Críticos"
                value={openAlerts.filter(a => a.severity === "critical").length}
                icon={AlertTriangle}
                color="destructive"
              />
              <StatCard
                label="Avisos"
                value={openAlerts.filter(a => a.severity === "warn").length}
                icon={AlertTriangle}
                color="warning"
              />
              <StatCard
                label="Informativos"
                value={openAlerts.filter(a => a.severity === "info").length}
                icon={AlertTriangle}
                color="muted"
              />
            </div>
          )}

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
