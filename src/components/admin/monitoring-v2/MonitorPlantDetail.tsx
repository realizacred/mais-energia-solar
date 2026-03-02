import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Sun, ArrowLeft, Zap, Activity, AlertTriangle, Cpu } from "lucide-react";
import { getPlantDetail, listDevices, listAlerts, listDailyReadings } from "@/services/monitoring/monitorService";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { DeviceMpptSummary } from "./devices/DeviceMpptSummary";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  alert: "Alerta",
  offline: "Offline",
  unknown: "Sem dados",
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-success",
  alert: "bg-warning",
  offline: "bg-destructive",
  unknown: "bg-muted-foreground",
};

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
  const [range, setRange] = useState<TimeRange>("30d");

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

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString().slice(0, 10);

  const { data: readings = [] } = useQuery({
    queryKey: ["monitor-readings", plantId, range],
    queryFn: () => listDailyReadings(plantId!, startDate, endDate),
    enabled: !!plantId,
  });

  if (isLoading) return <LoadingState message="Carregando usina..." />;
  if (!plant) return <EmptyState icon={Sun} title="Usina não encontrada" />;

  const status = plant.health?.status || "unknown";

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
                <div className={cn("h-2.5 w-2.5 rounded-full", STATUS_DOT[status])} />
                <StatusBadge status={STATUS_LABELS[status]} />
                {plant.health?.last_seen_at && (
                  <span className="text-xs text-muted-foreground">
                    Visto {formatDistanceToNow(new Date(plant.health.last_seen_at), { addSuffix: true, locale: ptBR })}
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
        <DetailKpi label="Energia Hoje" value={`${(plant.health?.energy_today_kwh || 0).toFixed(0)} kWh`} icon={Activity} color="success" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices */}
        <SectionCard title={`Dispositivos (${devices.length})`} icon={Cpu}>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dispositivo registrado</p>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => (
                <div key={d.id} className="rounded-lg border border-border/60 bg-card hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.model || d.type}</p>
                      <p className="text-xs text-muted-foreground">{d.serial || d.provider_device_id}</p>
                    </div>
                    <StatusBadge status={d.status === "online" ? "Online" : d.status === "offline" ? "Offline" : "Desconhecido"} size="sm" />
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
