import React from "react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { MonitorNav } from "./MonitorNav";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Sun, Zap, Activity, Gauge, WifiOff, AlertTriangle,
  BatteryCharging, BarChart3, CloudSun, Wrench,
  RefreshCw, Clock, Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MonitorStatusDonut } from "./charts/MonitorStatusDonut";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorGenerationVsEstimateChart } from "./charts/MonitorGenerationVsEstimateChart";
import { EnergyFlowAnimation } from "./EnergyFlowAnimation";
import { WeatherWidget } from "./WeatherWidget";
import { MaintenanceCalendar } from "./MaintenanceCalendar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useMonitorDashboardData } from "@/hooks/useMonitorDashboardData";
import { EnterpriseKpi } from "./EnterpriseKpi";
import { PriorityAlertBlock } from "./PriorityAlertBlock";
import { OperationalSummary } from "./OperationalSummary";
import { OfflineStandbySection } from "./OfflineStandbySection";

export default function MonitorDashboard() {
  const navigate = useNavigate();

  const {
    stats, plants, openAlerts, readings, financials, prData, isLoading,
    totalPowerMwp, totalEnergyTodayMwh, totalEnergyMonthMwh,
    activeCount, activePerc, isNight, alertCount, avgPR,
    avgLat, avgLng, isGenerating, isDaylight, realCurrentPower,
    lastSync, nextSync,
  } = useMonitorDashboardData();

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

  return (
    <div className="w-full space-y-8">
      {/* ─── Header (§26) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <PageHeader
          title="Monitoramento Solar"
          description="Visão geral das usinas fotovoltaicas"
          icon={Sun}
        />
        {lastSync && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border shrink-0">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync: <span className="text-foreground">{formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}</span></span>
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Próxima: <span className="text-foreground">{nextSync && nextSync > new Date() ? nextSync.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "em breve"}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Tabs (§29) ─── */}
      <MonitorNav />

      {isEmpty ? (
        <EmptyState icon={Sun} title="Nenhuma usina cadastrada" description="Conecte um provedor de monitoramento para começar." />
      ) : (
        <>
          {/* ═══ KPI ROW 1 ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EnterpriseKpi
              icon={Sun} label="Total Usinas" value={String(stats.total_plants)}
              accentColor="primary"
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
              accentColor="destructive"
              onClick={() => navigate("/admin/monitoramento/usinas?status=offline")}
            />
            <EnterpriseKpi
              icon={Moon} label="Standby"
              value={String(stats.plants_standby || 0)}
              accentColor="warning"
              onClick={() => navigate("/admin/monitoramento/usinas?status=standby")}
            />
          </div>

          {/* ═══ KPI ROW 2 ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <EnterpriseKpi
              icon={AlertTriangle} label="Com Alerta"
              value={String(alertCount)}
              accentColor={alertCount > 0 ? "warning" : "muted"}
              onClick={() => navigate("/admin/monitoramento/alertas")}
            />
            <EnterpriseKpi
              icon={Gauge} label="Potência Instalada"
              value={totalPowerMwp >= 1 ? `${totalPowerMwp.toFixed(1)} MWp` : `${(totalPowerMwp * 1000).toFixed(0)} kWp`}
              accentColor="primary"
            />
            <EnterpriseKpi
              icon={Zap} label="Energia Hoje"
              value={totalEnergyTodayMwh >= 1 ? `${totalEnergyTodayMwh.toFixed(1)} MWh` : `${(stats.energy_today_kwh || 0).toFixed(0)} kWh`}
              accentColor="success"
            />
            <EnterpriseKpi
              icon={BatteryCharging} label="Energia do Mês"
              value={totalEnergyMonthMwh >= 1 ? `${totalEnergyMonthMwh.toFixed(1)} MWh` : `${(stats.energy_month_kwh || 0).toFixed(0)} kWh`}
              accentColor="primary"
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

          {/* ═══ GERAÇÃO 30 DIAS ═══ */}
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
