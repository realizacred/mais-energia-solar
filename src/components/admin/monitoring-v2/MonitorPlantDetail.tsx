import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { StatCard } from "@/components/ui-kit/StatCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Sun, ArrowLeft, Zap, Activity, AlertTriangle, Cpu, MapPin, ExternalLink } from "lucide-react";
import { getPlantDetail, listDevices, listAlerts, listDailyReadings } from "@/services/monitoring/monitorService";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  alert: "Alerta",
  offline: "Offline",
  unknown: "Sem dados",
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/admin/monitoramento/usinas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={plant.name || "Usina"}
            description={[plant.city, plant.state].filter(Boolean).join(" - ")}
            icon={Sun}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge status={STATUS_LABELS[status]} />
                {plant.health?.last_seen_at && (
                  <span className="text-2xs text-muted-foreground">
                    Visto {formatDistanceToNow(new Date(plant.health.last_seen_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Potência Instalada"
          value={`${plant.installed_power_kwp || 0} kWp`}
          icon={Zap}
          color="warning"
        />
        <StatCard
          label="Energia Hoje"
          value={`${(plant.health?.energy_today_kwh || 0).toFixed(0)} kWh`}
          icon={Activity}
          color="success"
        />
        <StatCard
          label="Energia Mês"
          value={`${(plant.health?.energy_month_kwh || 0).toFixed(0)} kWh`}
          icon={Activity}
          color="info"
        />
        <StatCard
          label="Alertas Abertos"
          value={plant.health?.open_alerts_count || 0}
          icon={AlertTriangle}
          color={plant.health?.open_alerts_count ? "destructive" : "muted"}
        />
      </div>

      {/* Generation chart with time range tabs */}
      <SectionCard
        title="Geração"
        icon={Activity}
        variant="blue"
        actions={
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "365d"] as TimeRange[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? "default" : "outline"}
                onClick={() => setRange(r)}
                className="text-xs"
              >
                {r === "7d" ? "7 dias" : r === "30d" ? "30 dias" : r === "90d" ? "90 dias" : "1 ano"}
              </Button>
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
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.model || d.type}</p>
                    <p className="text-2xs text-muted-foreground">{d.serial || d.provider_device_id}</p>
                  </div>
                  <StatusBadge status={d.status === "online" ? "Online" : d.status === "offline" ? "Offline" : "Desconhecido"} size="sm" />
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
