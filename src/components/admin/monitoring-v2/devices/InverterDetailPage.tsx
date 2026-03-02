import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cpu, Zap, Activity, RefreshCw } from "lucide-react";
import { listDevices, syncPlantDevices } from "@/services/monitoring/monitorService";
import { extractMpptData } from "./DeviceMpptSummary";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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

  const data = extractMpptData(device.metadata);
  const meta = device.metadata || {};

  // Extract additional metadata fields
  const firmware = String(meta.inverterSoftwareVersion ?? meta.firmwareVersion ?? "—");
  const dataLogger = String(meta.collectorSn ?? meta.dataLoggerId ?? "—");
  const lastUpdate = String(meta.dataTimestampStr ?? "");
  const acOutputType = Number(meta.acOutputType ?? -1);
  const phases = acOutputType === 0 ? "Monofásico" : acOutputType === 1 ? "Bifásico" : acOutputType === 2 ? "Trifásico" : "—";
  const ratedPower = Number(meta.power ?? meta.power1 ?? 0);
  const currentAcPower = Number(meta.pac ?? 0);
  const stationName = String(meta.stationName ?? "");
  const isOffline = device.status !== "online";

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncPlantDevices(plantId!);
      await queryClient.invalidateQueries({ queryKey: ["monitor-devices", plantId] });
      toast({ title: "Dados atualizados", description: "Sincronização concluída com sucesso." });
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
                <StatusBadge
                  status={device.status === "online" ? "Online" : device.status === "offline" ? "Offline" : "Desconhecido"}
                />
                {device.last_seen_at && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true, locale: ptBR })}
                  </span>
                )}
              </div>
            }
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <InvKpi label="Potência Nominal" value={`${ratedPower} kW`} icon={Zap} />
        <InvKpi label="Potência AC Atual" value={`${(currentAcPower * 1000).toFixed(0)} W`} icon={Activity} />
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
          <div className="space-y-4">
            {isOffline && (
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
              // Try multiple field name patterns for Vpv/Ipv
              const vpv = Number(meta[`vpv${ch.index}`] ?? meta[`uPv${ch.index}`] ?? meta[`pv${ch.index}Voltage`] ?? 0);
              const ipv = Number(meta[`ipv${ch.index}`] ?? meta[`iPv${ch.index}`] ?? meta[`pv${ch.index}Current`] ?? 0);

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

function InvKpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 card-stat-elevated">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
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
