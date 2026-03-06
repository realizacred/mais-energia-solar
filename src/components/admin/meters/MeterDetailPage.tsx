/**
 * MeterDetailPage — Detail view for a single meter device.
 * Route: /admin/medidores/:id
 */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Gauge, ArrowLeft, Wifi, WifiOff, ArrowLeftRight, Zap, Activity,
  Clock, ChevronDown, ChevronUp, Link2, AlertTriangle
} from "lucide-react";

export default function MeterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showRaw, setShowRaw] = useState(false);

  const { data: meter, isLoading, error } = useQuery({
    queryKey: ["meter_device", id],
    queryFn: () => meterService.getById(id!),
    enabled: !!id,
  });

  const { data: latestStatus } = useQuery({
    queryKey: ["meter_status_latest", id],
    queryFn: () => meterService.getStatusLatest(id!),
    enabled: !!id,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ["meter_readings", id],
    queryFn: () => meterService.getLatestReadings(id!, 20),
    enabled: !!id,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["meter_links", id],
    queryFn: () => meterService.getLinksForMeter(id!),
    enabled: !!id,
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ["meter_sync_logs", meter?.integration_config_id],
    queryFn: async () => {
      if (!meter?.integration_config_id) return [];
      const { data } = await supabase
        .from("integration_sync_runs")
        .select("*")
        .eq("integration_config_id", meter.integration_config_id)
        .order("started_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!meter?.integration_config_id,
  });

  const activeLink = links.find(l => l.is_active);

  // Get UC name for active link
  const { data: linkedUC } = useQuery({
    queryKey: ["uc_for_meter", activeLink?.unit_id],
    queryFn: async () => {
      if (!activeLink) return null;
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("id", activeLink.unit_id)
        .single();
      return data;
    },
    enabled: !!activeLink,
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !meter) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/medidores")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <EmptyState icon={AlertTriangle} title="Medidor não encontrado" description="O medidor solicitado não existe ou foi removido." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/medidores")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-card to-muted/30 border shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Gauge className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Nome</p>
              <p className="text-sm font-bold truncate">{meter.name}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Modelo</p>
              <p className="text-sm font-bold">{meter.model || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Provider</p>
              <Badge variant="outline" className="text-xs capitalize">{meter.provider}</Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Device ID</p>
              <p className="text-xs font-mono truncate">{meter.external_device_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meter.bidirectional_supported && (
              <Badge variant="outline" className="text-xs">
                <ArrowLeftRight className="w-3 h-3 mr-0.5" /> Bidirecional
              </Badge>
            )}
            <StatusBadge variant={meter.online_status === "online" ? "success" : "destructive"} dot>
              {meter.online_status === "online" ? "Online" : "Offline"}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current readings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Leitura Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestStatus ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Potência</p>
                  <p className="text-lg font-bold">{latestStatus.power_w != null ? `${latestStatus.power_w} W` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tensão</p>
                  <p className="text-lg font-bold">{latestStatus.voltage_v != null ? `${latestStatus.voltage_v} V` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Corrente</p>
                  <p className="text-lg font-bold">{latestStatus.current_a != null ? `${latestStatus.current_a} A` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Energia Importada</p>
                  <p className="text-lg font-bold">{latestStatus.energy_import_kwh != null ? `${latestStatus.energy_import_kwh} kWh` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Energia Exportada</p>
                  <p className="text-lg font-bold">{latestStatus.energy_export_kwh != null ? `${latestStatus.energy_export_kwh} kWh` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última Atualização</p>
                  <p className="text-sm">{new Date(latestStatus.measured_at).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma leitura disponível. Sincronize as leituras na página de APIs.</p>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Informações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Fabricante</p>
                <p>{meter.manufacturer || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Firmware</p>
                <p>{meter.firmware_version || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p>{meter.category || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serial</p>
                <p className="font-mono text-xs">{meter.serial_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">UC Vinculada</p>
                {linkedUC ? (
                  <button
                    className="text-primary hover:underline font-medium text-sm"
                    onClick={() => navigate(`/admin/ucs/${linkedUC.id}`)}
                  >
                    {linkedUC.nome}
                  </button>
                ) : (
                  <span className="text-muted-foreground italic">Não vinculado</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última Comunicação</p>
                <p>{meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent readings */}
      {readings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Histórico Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data/Hora</TableHead>
                    <TableHead className="text-xs">Potência (W)</TableHead>
                    <TableHead className="text-xs">Tensão (V)</TableHead>
                    <TableHead className="text-xs">Corrente (A)</TableHead>
                    <TableHead className="text-xs">Energia Imp. (kWh)</TableHead>
                    <TableHead className="text-xs">Energia Exp. (kWh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {readings.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.measured_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs font-mono">{r.power_w ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.voltage_v ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.current_a ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.energy_import_kwh ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.energy_export_kwh ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw payload */}
      <Card>
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowRaw(!showRaw)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground">Payload Técnico (Raw Device)</CardTitle>
            {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardHeader>
        {showRaw && (
          <CardContent>
            <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-[300px]">
              {JSON.stringify(meter.metadata, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
