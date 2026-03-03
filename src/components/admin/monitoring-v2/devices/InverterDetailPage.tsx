import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cpu, Zap, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import { listDevices, syncPlantDevices } from "@/services/monitoring/monitorService";
import { extractMpptData } from "./DeviceMpptSummary";
import { deriveDeviceStatus, DEVICE_STATUS_LABELS, computeDeviceStaleness, formatRelativeSeenAt, getDeviceSsotTimestamp } from "@/services/monitoring/plantStatusEngine";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function InverterDetailPage() {
  const { plantId, deviceId } = useParams<{ plantId: string; deviceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = React.useState(false);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["monitor-devices", plantId],
    queryFn: () => listDevices(plantId!),
    enabled: !!plantId,
  });

  const device = devices.find((d) => d.id === deviceId);

  if (isLoading) return <LoadingState message="Carregando inversor..." />;
  if (!device) return <EmptyState icon={Cpu} title="Inversor não encontrado" />;

  const rawData = extractMpptData(device.metadata);
  const meta = device.metadata || {};

  // ─── SSOT: Derive device status instead of using raw device.status ───
  const deviceSeenAt = getDeviceSsotTimestamp(device);
  const derived = deriveDeviceStatus({
    rawStatus: device.status,
    lastSeenAt: deviceSeenAt,
  });
  const snapshotAt = deviceSeenAt;
  const staleness = computeDeviceStaleness(snapshotAt);
  const isStale = staleness.stale;
  const isOffline = derived.status === "offline" || derived.status === "standby";
  const statusLabel = DEVICE_STATUS_LABELS[derived.status];

  // ─── SSOT: Zero out instantaneous power when offline/standby (stale data) ───
  const data = isOffline
    ? {
        ...rawData,
        channels: rawData.channels.map(ch => ({ ...ch, power_w: 0 })),
        totalStringPower: 0,
        acPower: 0,
        maxPvVoltage: null,
      }
    : rawData;

  // Extract additional metadata fields — support multiple provider field names
  const firmware = String(meta.inverterSoftwareVersion ?? meta.firmwareVersion ?? "—");
  const dataLogger = String(meta.collectorSn ?? meta.dataLoggerId ?? meta.deviceSn ?? "—");
  const lastUpdate = String(meta.dataTimestampStr ?? (meta.collectionTime ? new Date(Number(meta.collectionTime) * 1000).toLocaleString("pt-BR") : "") ?? "");
  const acOutputType = Number(meta.acOutputType ?? -1);
  const phases = acOutputType === 0 ? "Monofásico" : acOutputType === 1 ? "Bifásico" : acOutputType === 2 ? "Trifásico" : "—";
  const ratedPower = Number(meta.power ?? 0) || Number(meta.RatedPower ?? 0) / 1000;
  const currentAcPower = isOffline ? 0 : (Number(meta.pac ?? 0) || Number(meta.TotalActiveACOutputPower ?? 0) / 1000);
  const stationName = String(meta.stationName ?? meta.plantName ?? "");

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPlantDevices(plantId!);
      await queryClient.invalidateQueries({ queryKey: ["monitor-devices", plantId] });

      // Smart feedback: check if device data actually changed
      const hasErrors = result.errors.length > 0;
      const metricsOk = result.metrics_synced > 0;

      if (hasErrors && !metricsOk) {
        toast({ title: "Sincronização parcial", description: `Dispositivo pode estar sem comunicação. ${result.errors[0] || ""}`, variant: "destructive" });
      } else if (!metricsOk) {
        toast({ title: "Sincronização concluída", description: "Dispositivo sem dados novos do provedor — pode estar offline." });
      } else {
        toast({ title: "Dados atualizados", description: "Sincronização concluída com sucesso." });
      }
    } catch (err) {
      toast({ title: "Erro ao sincronizar", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/admin/monitoramento/usinas/${plantId}`)}
          className="h-8 w-8 p-0 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={data.machineName || device.model || "Inversor"}
            description={`SN: ${device.serial || device.provider_device_id || "—"}`}
            icon={Cpu}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                  {syncing ? "Atualizando..." : "Atualizar"}
                </Button>
                <StatusBadge status={statusLabel} />
                {snapshotAt && (
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeSeenAt(snapshotAt, { addSuffix: true })}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* Staleness banner */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            <strong>Dados do inversor desatualizados.</strong>{" "}
            {snapshotAt
              ? `Última leitura ${formatRelativeSeenAt(snapshotAt, { addSuffix: true })}.`
              : "Sem data de sincronização."}
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InvKpi label="Potência Nominal" value={`${ratedPower} kW`} icon={Zap} />
        <InvKpi label="Potência AC Atual" value={`${(currentAcPower * 1000).toFixed(0)} W`} icon={Activity} muted={isStale} />
        <InvKpi label="Energia Hoje" value={`${data.energyToday.toFixed(1)} kWh`} icon={Activity} />
        <InvKpi
          label="Energia Total"
          value={data.energyTotal >= 1000 ? `${(data.energyTotal / 1000).toFixed(1)} MWh` : `${data.energyTotal.toFixed(0)} kWh`}
          icon={Activity}
        />
      </div>

      {/* MPPT / String Detail */}
      <SectionCard title={`Canais MPPT / Strings (${data.channels.length})`} icon={Zap} variant="blue">
        {data.channels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Dados de string não disponíveis. Clique em "Atualizar" para buscar dados.
          </p>
        ) : (
          <div className={cn("space-y-4", isStale && "opacity-60")}>
            {isStale && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning text-center font-medium">
                ⚠ Dados desatualizados — valores abaixo referem-se à última leitura disponível.
              </div>
            )}
            {(isOffline && !isStale) && (
              <div className="rounded-lg bg-muted/30 border border-border/50 px-3 py-2 text-xs text-muted-foreground text-center">
                ⚡ Inversor offline/noturno — valores de potência, tensão e corrente podem estar zerados.
              </div>
            )}

            {/* Header */}
            <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground font-medium px-1">
              <span>Canal</span>
              <span className="text-right">Potência</span>
              <span className="text-right">Tensão (Vpv)</span>
              <span className="text-right">Corrente (Ipv)</span>
            </div>

            {data.channels.map((ch) => {
              // Try multiple field name patterns for Vpv/Ipv (Solis: vpv1/ipv1, Growatt: vpv1/ipv1, legacy: uPv1/iPv1)
              const rawVpv = Number(meta[`vpv${ch.index}`] ?? meta[`uPv${ch.index}`] ?? meta[`pv${ch.index}Voltage`] ?? meta[`Vpv${ch.index}`] ?? 0);
              const rawIpv = Number(meta[`ipv${ch.index}`] ?? meta[`iPv${ch.index}`] ?? meta[`pv${ch.index}Current`] ?? meta[`Ipv${ch.index}`] ?? 0);
              // Zero out Vpv/Ipv when offline/standby (stale data)
              const vpv = isOffline ? 0 : rawVpv;
              const ipv = isOffline ? 0 : rawIpv;

              return (
                <div
                  key={ch.index}
                  className={cn(
                    "grid grid-cols-4 gap-2 items-center px-3 py-2.5 rounded-lg border transition-colors",
                    ch.power_w > 0
                      ? "border-success/30 bg-success/5"
                      : "border-border/50 bg-muted/10"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">
                    String {ch.index}
                  </span>
                  <span className={cn(
                    "text-sm font-bold text-right",
                    ch.power_w > 0 ? "text-success" : "text-muted-foreground"
                  )}>
                    {`${ch.power_w} W`}
                  </span>
                  <span className="text-sm text-right text-foreground">
                    {vpv > 0 ? `${vpv.toFixed(1)} V` : "0 V"}
                  </span>
                  <span className="text-sm text-right text-foreground">
                    {ipv > 0 ? `${ipv.toFixed(2)} A` : "0 A"}
                  </span>
                </div>
              );
            })}

            {/* Totals */}
            <div className="grid grid-cols-4 gap-2 items-center px-3 py-2.5 rounded-lg border-2 border-border font-semibold text-sm">
              <span>Total DC</span>
              <span className="text-right text-success">{`${data.totalStringPower} W`}</span>
              <span className="text-right text-muted-foreground">
                {data.maxPvVoltage ? `Vmáx ${data.maxPvVoltage.toFixed(1)} V` : "—"}
              </span>
              <span className="text-right text-muted-foreground">—</span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Technical Info */}
      <SectionCard title="Informações Técnicas" icon={Cpu}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="Modelo" value={data.machineName || device.model || "—"} />
          <InfoRow label="Serial" value={device.serial || "—"} />
          <InfoRow label="Fases" value={phases} />
          <InfoRow label="MPPTs" value={data.mpptCount > 0 ? String(data.mpptCount) : "—"} />
          <InfoRow label="Firmware" value={firmware} />
          <InfoRow label="Data Logger" value={dataLogger} />
          <InfoRow label="Usina" value={stationName || "—"} />
          <InfoRow label="Última Atualização" value={lastUpdate || "—"} />
        </div>
      </SectionCard>
    </div>
  );
}

function InvKpi({ label, value, icon: Icon, muted }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; muted?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4 card-stat-elevated", muted && "opacity-50")}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
          {muted && <p className="text-[10px] text-warning">última leitura</p>}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
