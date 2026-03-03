import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sun, ArrowLeft, Zap, Activity, AlertTriangle, Cpu, RefreshCw, ChevronDown } from "lucide-react";
import { getPlantDetail, listDevices, listAlerts, listDailyReadings, syncPlantDevices } from "@/services/monitoring/monitorService";
import { toast } from "sonner";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorAttentionList } from "./MonitorAttentionList";
import { extractMpptData } from "./devices/DeviceMpptSummary";
import { PlantMpptSection } from "./devices/PlantMpptSection";
import { cn } from "@/lib/utils";
import {
  UI_STATUS_LABELS, UI_STATUS_DOT, getTodayBrasilia, getDaysAgoBrasilia,
  resolveHealthToUiStatus, deriveDeviceStatus, computeDeviceStaleness, formatRelativeSeenAt,
  getDeviceSsotTimestamp,
  DEVICE_STATUS_LABELS, DEVICE_STATUS_DOT, DEVICE_STATUS_TEXT,
  type PlantUiStatus,
} from "@/services/monitoring/plantStatusEngine";
import type { MonitorDevice } from "@/services/monitoring/monitorTypes";

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

      {/* Devices with inline technical details */}
      <SectionCard title={`Dispositivos (${devices.length})`} icon={Cpu}>
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum dispositivo registrado</p>
        ) : (
          <div className="space-y-3">
            {devices.map((d) => (
              <DeviceCardWithDetails key={d.id} device={d} plantStatus={status} />
            ))}
          </div>
        )}
      </SectionCard>

      {/* MPPT & Strings */}
      <PlantMpptSection plantId={plantId!} devices={devices} isOffline={status === "offline"} />

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

/* ─── Device Card with Inline Expandable Technical Details ─── */

function DeviceCardWithDetails({ device: d, plantStatus }: { device: MonitorDevice; plantStatus: PlantUiStatus }) {
  const [open, setOpen] = useState(false);

  const deviceSeenAt = getDeviceSsotTimestamp(d);
  const deviceDerived = deriveDeviceStatus({
    rawStatus: d.status,
    lastSeenAt: deviceSeenAt,
  });
  const coherentStatus = plantStatus === "offline" && deviceDerived.status !== "offline"
    ? computeDeviceStaleness(deviceSeenAt).stale ? "offline" as const : deviceDerived.status
    : deviceDerived.status;

  const isInverter = d.type === "inverter";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border/60 bg-card hover:shadow-sm transition-all overflow-hidden">
        <div className="flex items-center justify-between p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {d.type === "logger" ? "Datalogger" : (d.model || d.type)}
            </p>
            <p className="text-xs text-muted-foreground">{d.serial || d.provider_device_id}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", DEVICE_STATUS_DOT[coherentStatus])} />
            <span className={cn("text-xs font-medium", DEVICE_STATUS_TEXT[coherentStatus])}>
              {DEVICE_STATUS_LABELS[coherentStatus]}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1">
              {formatRelativeSeenAt(deviceSeenAt, { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Inline summary for inverters */}
        {isInverter && (
          <div className="px-3 pb-2 border-t border-border/30 pt-2">
            <InverterSummaryRow device={d} isOffline={coherentStatus === "offline" || coherentStatus === "standby"} />
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors mt-2">
                {open ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          </div>
        )}

        {/* Expanded technical details */}
        {isInverter && (
          <CollapsibleContent>
            <InverterExpandedDetails device={d} isOffline={coherentStatus === "offline" || coherentStatus === "standby"} />
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

/* ─── Inverter Summary Row (always visible) ─── */

function InverterSummaryRow({ device, isOffline }: { device: MonitorDevice; isOffline: boolean }) {
  const rawData = extractMpptData(device.metadata);
  const data = isOffline
    ? { ...rawData, channels: rawData.channels.map(ch => ({ ...ch, power_w: 0 })), totalStringPower: 0 }
    : rawData;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-medium truncate max-w-[60%]">
        {data.machineName || device.model || device.type}
      </span>
      <div className="flex items-center gap-3">
        {data.energyToday > 0 && (
          <span className="text-foreground">
            <span className="text-muted-foreground">Hoje: </span>
            <span className="font-semibold">{data.energyToday.toFixed(1)} kWh</span>
          </span>
        )}
        {data.channels.length > 0 && (
          <span className="text-muted-foreground">
            {data.channels.length} strings
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Inverter Expanded Details (MPPT channels + technical info) ─── */

function InverterExpandedDetails({ device, isOffline }: { device: MonitorDevice; isOffline: boolean }) {
  const rawData = extractMpptData(device.metadata);
  const staleness = computeDeviceStaleness(getDeviceSsotTimestamp(device));
  const isStale = staleness.stale;
  const meta = device.metadata || {};

  const data = isOffline
    ? {
        ...rawData,
        channels: rawData.channels.map(ch => ({ ...ch, power_w: 0 })),
        totalStringPower: 0,
        acPower: 0,
        maxPvVoltage: null,
      }
    : rawData;

  const firmware = String(meta.inverterSoftwareVersion ?? meta.firmwareVersion ?? "—");
  const ratedPower = Number(meta.power ?? 0) || Number(meta.RatedPower ?? 0) / 1000;
  const currentAcPower = isOffline ? 0 : (Number(meta.pac ?? 0) || Number(meta.TotalActiveACOutputPower ?? 0) / 1000);

  return (
    <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-4">
      {/* Staleness warning */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning font-medium">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Dados desatualizados — {staleness.label}
        </div>
      )}

      {/* KPIs row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniKpi label="Potência Nominal" value={`${ratedPower} kW`} />
        <MiniKpi label="Potência AC" value={`${(currentAcPower * 1000).toFixed(0)} W`} muted={isStale} />
        <MiniKpi label="Energia Hoje" value={`${data.energyToday.toFixed(1)} kWh`} />
        <MiniKpi
          label="Energia Total"
          value={data.energyTotal >= 1000 ? `${(data.energyTotal / 1000).toFixed(1)} MWh` : `${data.energyTotal.toFixed(0)} kWh`}
        />
      </div>

      {/* MPPT Channels */}
      {data.channels.length > 0 && (
        <div className={cn("space-y-2", isStale && "opacity-60")}>
          <p className="text-[11px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-primary" />
            Canais MPPT / Strings ({data.channels.length})
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-[10px] text-muted-foreground font-medium px-1">
            <span>Canal</span>
            <span className="text-right">Potência</span>
            <span className="text-right">Vpv</span>
            <span className="text-right">Ipv</span>
          </div>
          {data.channels.map((ch) => {
            const rawVpvVal = meta[`vpv${ch.index}`] ?? meta[`uPv${ch.index}`] ?? meta[`pv${ch.index}Voltage`] ?? meta[`Vpv${ch.index}`] ?? meta[`Upv${ch.index}`];
            const rawIpvVal = meta[`ipv${ch.index}`] ?? meta[`iPv${ch.index}`] ?? meta[`pv${ch.index}Current`] ?? meta[`Ipv${ch.index}`] ?? meta[`IPv${ch.index}`];
            const rawVpv = rawVpvVal != null && String(rawVpvVal) !== "null" ? Number(rawVpvVal) : null;
            const rawIpv = rawIpvVal != null && String(rawIpvVal) !== "null" ? Number(rawIpvVal) : null;
            const maxVoltage = data.maxPvVoltage ?? null;
            const derivedIpv = (rawIpv == null && ch.power_w > 0 && maxVoltage && maxVoltage > 0) ? ch.power_w / maxVoltage : null;
            const derivedVpv = (rawVpv == null && ch.power_w > 0 && maxVoltage && maxVoltage > 0) ? maxVoltage : null;
            const vpv = isOffline ? 0 : (rawVpv ?? derivedVpv);
            const ipv = isOffline ? 0 : (rawIpv ?? derivedIpv);

            return (
              <div
                key={ch.index}
                className={cn(
                  "grid grid-cols-4 gap-1.5 items-center px-2.5 py-2 rounded-lg border text-xs",
                  ch.power_w > 0 ? "border-success/30 bg-success/5" : "border-border/50 bg-muted/10"
                )}
              >
                <span className="font-medium text-foreground">S{ch.index}</span>
                <span className={cn("text-right font-bold", ch.power_w > 0 ? "text-success" : "text-muted-foreground")}>
                  {ch.power_w} W
                </span>
                <span className="text-right text-foreground">
                  {vpv == null ? "—" : vpv > 0 ? `${rawVpv == null ? "≈" : ""}${vpv.toFixed(1)} V` : "0 V"}
                </span>
                <span className="text-right text-foreground">
                  {ipv == null ? "—" : ipv > 0 ? `${rawIpv == null ? "≈" : ""}${ipv.toFixed(2)} A` : "0 A"}
                </span>
              </div>
            );
          })}
          {/* Totals */}
          <div className="grid grid-cols-4 gap-1.5 items-center px-2.5 py-2 rounded-lg border-2 border-border font-semibold text-xs">
            <span>Total DC</span>
            <span className="text-right text-success">{data.totalStringPower} W</span>
            <span className="text-right text-muted-foreground">
              {data.maxPvVoltage ? `Vmáx ${data.maxPvVoltage.toFixed(1)} V` : "—"}
            </span>
            <span className="text-right text-muted-foreground">—</span>
          </div>
        </div>
      )}

      {/* Technical info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <InfoRow label="Modelo" value={data.machineName || device.model || "—"} />
        <InfoRow label="Serial" value={device.serial || "—"} />
        <InfoRow label="MPPTs" value={data.mpptCount > 0 ? String(data.mpptCount) : "—"} />
        <InfoRow label="Firmware" value={firmware} />
      </div>
    </div>
  );
}

function MiniKpi({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("rounded-lg border border-border/40 bg-muted/20 p-2.5 text-center", muted && "opacity-50")}>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground truncate max-w-[55%] text-right">{value}</span>
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