import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Sun, ArrowLeft, Zap, Activity, AlertTriangle, Cpu, RefreshCw } from "lucide-react";
import { getPlantDetail, listDevices, listAlerts, listDailyReadings, syncPlantDevices } from "@/services/monitoring/monitorService";
import { toast } from "sonner";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { DeviceMpptSummary } from "./devices/DeviceMpptSummary";
import { cn } from "@/lib/utils";
import {
  UI_STATUS_LABELS, UI_STATUS_DOT, getTodayBrasilia, getDaysAgoBrasilia,
  resolveHealthToUiStatus, deriveDeviceStatus, computeDeviceStaleness, formatRelativeSeenAt,
  getDeviceSsotTimestamp,
  DEVICE_STATUS_LABELS, DEVICE_STATUS_DOT, DEVICE_STATUS_TEXT,
  type PlantUiStatus,
} from "@/services/monitoring/plantStatusEngine";

type TimeRange = "7d" | "30d" | "90d" | "365d";

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

export default function MonitorPlantDetail() {
  const { plantId } = useParams<{ plantId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<TimeRange>("30d");
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!plantId || syncing) return;
    setSyncing(true);
    try {
      const result = await syncPlantDevices(plantId);
      queryClient.invalidateQueries({ queryKey: ["monitor-plant-detail", plantId] });
      queryClient.invalidateQueries({ queryKey: ["monitor-devices", plantId] });
      queryClient.invalidateQueries({ queryKey: ["monitor-readings", plantId] });
      queryClient.invalidateQueries({ queryKey: ["monitor-alerts-plant", plantId] });

      const hasErrors = result.errors.length > 0;
      const metricsOk = result.metrics_synced > 0;

      if (hasErrors && !metricsOk) {
        toast.error(`Sincronização parcial: ${result.errors[0] || "sem dados novos"}`);
      } else if (!metricsOk) {
        toast.info("Sincronização concluída — sem dados novos do provedor.");
      } else {
        toast.success("Sincronização concluída com sucesso!");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const { data: plant, isLoading } = useQuery({
    queryKey: ["monitor-plant-detail", plantId],
    queryFn: () => getPlantDetail(plantId!),
    enabled: !!plantId,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["monitor-devices", plantId],
    queryFn: () => listDevices(plantId!),
    enabled: !!plantId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["monitor-alerts-plant", plantId],
    queryFn: () => listAlerts({ plantId }),
    enabled: !!plantId,
  });

  const endDate = getTodayBrasilia();
  const startDate = getDaysAgoBrasilia(RANGE_DAYS[range]);

  const { data: readings = [] } = useQuery({
    queryKey: ["monitor-readings", plantId, range],
    queryFn: () => listDailyReadings(plantId!, startDate, endDate),
    enabled: !!plantId,
  });

  if (isLoading) return <LoadingState message="Carregando usina..." />;
  if (!plant) return <EmptyState icon={Sun} title="Usina não encontrada" />;

  const status = resolveHealthToUiStatus(plant.health?.status);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/admin/monitoramento/usinas")} className="h-8 w-8 p-0 rounded-lg">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={plant.name || "Usina"}
            description={[plant.city, plant.state].filter(Boolean).join(" - ")}
            icon={Sun}
            actions={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
                  <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                  {syncing ? "Sincronizando..." : "Sincronizar"}
                </Button>
                <div className={cn("h-2.5 w-2.5 rounded-full", UI_STATUS_DOT[status])} />
                <StatusBadge status={UI_STATUS_LABELS[status]} />
                {plant.health?.last_seen_at && (
                  <span className="text-xs text-muted-foreground" title={new Date(plant.health.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}>
                    Visto {formatRelativeSeenAt(plant.health.last_seen_at, { addSuffix: true })}
                    {" · "}
                    {new Date(plant.health.last_seen_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DetailKpi label="Potência Instalada" value={`${plant.installed_power_kwp || 0} kWp`} icon={Zap} color="warning" />
        <DetailKpi label={plant.health?.is_yesterday_fallback ? "Energia Ontem" : "Energia Hoje"} value={`${(plant.health?.energy_today_kwh || 0).toFixed(0)} kWh`} icon={Activity} color="success" />
        <DetailKpi label="Energia Mês" value={`${(plant.health?.energy_month_kwh || 0).toFixed(0)} kWh`} icon={Activity} color="info" />
        <DetailKpi label="Alertas Abertos" value={String(plant.health?.open_alerts_count || 0)} icon={AlertTriangle} color={plant.health?.open_alerts_count ? "destructive" : "muted"} />
      </div>

      {/* Generation chart with time range */}
      <SectionCard
        title="Geração"
        icon={Activity}
        variant="blue"
        actions={
          <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/50">
            {(["7d", "30d", "90d", "365d"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  range === r
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r === "7d" ? "7d" : r === "30d" ? "30d" : r === "90d" ? "90d" : "1a"}
              </button>
            ))}
          </div>
        }
      >
        <MonitorGenerationChart readings={readings} />
      </SectionCard>

      {/* Devices — full width */}
      <SectionCard title={`Dispositivos (${devices.length})`} icon={Cpu}>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dispositivo registrado</p>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => (
              <div key={d.id} className="rounded-lg border border-border/60 bg-card hover:shadow-sm transition-all overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {d.type === "logger" ? "Datalogger" : (d.model || d.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.serial || d.provider_device_id}</p>
                  </div>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const deviceSeenAt = getDeviceSsotTimestamp(d);
                        const deviceDerived = deriveDeviceStatus({
                          rawStatus: d.status,
                          lastSeenAt: deviceSeenAt,
                        });
                        // Coherence: if plant is OFFLINE, device cannot be online/standby
                        const coherentStatus = status === "offline" && deviceDerived.status !== "offline"
                          ? computeDeviceStaleness(deviceSeenAt).stale ? "offline" as const : deviceDerived.status
                          : deviceDerived.status;

                        // DEBUG SSOT — temporary instrumentation
                        if (import.meta.env.DEV) {
                          const ageMin = deviceSeenAt ? Math.round((Date.now() - new Date(deviceSeenAt).getTime()) / 60000) : null;
                          console.log(`[SSOT DEVICE] id=${d.id} raw=${d.status} last_seen_at=${deviceSeenAt} age=${ageMin}min derived=${deviceDerived.status} coherent=${coherentStatus}`);
                        }

                        return (
                          <>
                            <span className={cn("h-2 w-2 rounded-full", DEVICE_STATUS_DOT[coherentStatus])} />
                            <span className={cn("text-xs font-medium", DEVICE_STATUS_TEXT[coherentStatus])}>
                              {DEVICE_STATUS_LABELS[coherentStatus]}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {formatRelativeSeenAt(deviceSeenAt, { addSuffix: true })}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                </div>
                {d.type === "inverter" && (
                  <div className="px-3 pb-3 border-t border-border/30 pt-2">
                    <DeviceMpptSummary
                      device={d}
                      onViewDetail={() => navigate(`/admin/monitoramento/usinas/${plantId}/inversor/${d.id}`)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Alerts timeline */}
      <SectionCard title={`Eventos (${alerts.length})`} icon={AlertTriangle} variant="warning">
        <MonitorAttentionList
          alerts={alerts.slice(0, 15)}
          onViewPlant={() => {}}
        />
      </SectionCard>
    </div>
  );
}

type KpiColor = "primary" | "secondary" | "success" | "warning" | "destructive" | "info" | "muted";

const KPI_STYLES: Record<KpiColor, { iconBg: string; iconText: string }> = {
  primary:     { iconBg: "bg-primary/10",     iconText: "text-primary" },
  secondary:   { iconBg: "bg-secondary/10",   iconText: "text-secondary" },
  success:     { iconBg: "bg-success/10",     iconText: "text-success" },
  warning:     { iconBg: "bg-warning/10",     iconText: "text-warning" },
  destructive: { iconBg: "bg-destructive/10", iconText: "text-destructive" },
  info:        { iconBg: "bg-info/10",        iconText: "text-info" },
  muted:       { iconBg: "bg-muted",          iconText: "text-muted-foreground" },
};

function DetailKpi({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: KpiColor;
}) {
  const s = KPI_STYLES[color];
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 card-stat-elevated">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", s.iconBg)}>
          <Icon className={cn("h-5 w-5", s.iconText)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
