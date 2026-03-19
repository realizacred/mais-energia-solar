/**
 * MeterDetailPage — Detail view for a single meter device.
 * Route: /admin/medidores/:id
 */
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Gauge, ArrowLeft, ArrowLeftRight, Zap, Activity,
  Clock, ChevronDown, ChevronUp, AlertTriangle, Unlink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STALE_REALTIME = 1000 * 30;
const STALE_NORMAL = 1000 * 60 * 5;

export default function MeterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showRaw, setShowRaw] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const { data: meter, isLoading, error } = useQuery({
    queryKey: ["meter_device", id],
    queryFn: () => meterService.getById(id!),
    enabled: !!id,
    staleTime: STALE_NORMAL,
  });

  const { data: latestStatus } = useQuery({
    queryKey: ["meter_status_latest", id],
    queryFn: () => meterService.getStatusLatest(id!),
    enabled: !!id,
    staleTime: STALE_REALTIME,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ["meter_readings", id],
    queryFn: () => meterService.getLatestReadings(id!, 20),
    enabled: !!id,
    staleTime: STALE_REALTIME,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["meter_links", id],
    queryFn: () => meterService.getLinksForMeter(id!),
    enabled: !!id,
    staleTime: STALE_NORMAL,
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
    staleTime: STALE_NORMAL,
  });

  const activeLink = links.find(l => l.is_active);

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
    staleTime: STALE_NORMAL,
  });

  // CORREÇÃO 7 — Buscar usina vinculada à UC
  const { data: linkedPlant } = useQuery({
    queryKey: ["plant_for_uc", linkedUC?.id],
    queryFn: async () => {
      if (!linkedUC?.id) return null;
      const { data: link } = await supabase
        .from("unit_plant_links")
        .select("plant_id")
        .eq("unit_id", linkedUC.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!link?.plant_id) return null;
      const { data: plant } = await supabase
        .from("monitor_plants")
        .select("id, nome")
        .eq("id", link.plant_id)
        .maybeSingle();
      return plant;
    },
    enabled: !!linkedUC?.id,
    staleTime: STALE_NORMAL,
  });

  // CORREÇÃO 5 — Desvincular medidor
  async function handleDesvincular() {
    if (!activeLink) return;
    setUnlinking(true);
    try {
      await meterService.unlinkFromUnit(activeLink.id);
      toast({ title: "Medidor desvinculado com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_links", id] });
      qc.invalidateQueries({ queryKey: ["unit_meter_links"] });
      qc.invalidateQueries({ queryKey: ["meter_devices"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  }

  // CORREÇÃO 2 — Skeleton loading
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-32 mb-4" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-20 mb-2" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
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
              {/* CORREÇÃO 3 — Button shadcn em vez de <button> nativo */}
              <div>
                <p className="text-xs text-muted-foreground">UC Vinculada</p>
                {linkedUC ? (
                  <div className="space-y-1">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-sm font-medium"
                      onClick={() => navigate(`/admin/ucs/${linkedUC.id}`)}
                    >
                      {linkedUC.nome}
                    </Button>
                    {/* CORREÇÃO 7 — Usina vinculada */}
                    {linkedPlant && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        <span>Usina: {linkedPlant.nome}</span>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" asChild>
                          <Link to={`/admin/monitoramento/usinas/${linkedPlant.id}`}>
                            Ver usina →
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Não vinculado</span>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última Comunicação</p>
                <p>{meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </div>

            {/* CORREÇÃO 5 — Botão desvincular com AlertDialog */}
            {activeLink && linkedUC && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive text-destructive hover:bg-destructive/10 mt-2"
                    disabled={unlinking}
                  >
                    <Unlink className="w-4 h-4 mr-2" />
                    {unlinking ? "Desvinculando..." : "Desvincular UC"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[90vw] max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desvincular medidor?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja desvincular o medidor "{meter.name}" da UC "{linkedUC.nome}"?
                      Esta ação pode ser revertida vinculando novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDesvincular}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desvincular
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
