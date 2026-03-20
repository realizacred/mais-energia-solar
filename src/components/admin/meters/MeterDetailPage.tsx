/**
 * MeterDetailPage — Reformulated detail view for a single meter device.
 * Route: /admin/medidores/:id
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { tuyaIntegrationService } from "@/services/tuyaIntegrationService";
import { MeterAlertConfig } from "./MeterAlertConfig";
import { MeterCommandPanel } from "./MeterCommandPanel";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Gauge, ArrowLeft, Zap, Activity, BarChart3,
  Clock, AlertTriangle, Unlink, Power, PowerOff,
  RefreshCw, Loader2, Thermometer, ShieldAlert, Pencil, Check, X, Terminal,
  Save, CalendarDays, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Area, AreaChart
} from "recharts";

const STALE_REALTIME = 1000 * 30;
const STALE_NORMAL = 1000 * 60 * 5;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value?.toFixed(2) ?? "—"}</span>
        </p>
      ))}
    </div>
  );
};

export default function MeterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Leitura inicial state
  const [leitura03, setLeitura03] = useState("");
  const [leitura103, setLeitura103] = useState("");
  const [leituraData, setLeituraData] = useState("");
  const [leituraObs, setLeituraObs] = useState("");
  const [leituraLoaded, setLeituraLoaded] = useState(false);

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

  const readingsLimit = chartPeriod === "24h" ? 24 : chartPeriod === "7d" ? 168 : 720;
  const { data: readings = [] } = useQuery({
    queryKey: ["meter_readings", id, readingsLimit],
    queryFn: () => meterService.getLatestReadings(id!, readingsLimit),
    enabled: !!id,
    staleTime: STALE_REALTIME,
  });

  const { data: recentReadings = [] } = useQuery({
    queryKey: ["meter_readings_table", id],
    queryFn: () => meterService.getLatestReadings(id!, 50),
    enabled: !!id,
    staleTime: STALE_REALTIME,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["meter_links", id],
    queryFn: () => meterService.getLinksForMeter(id!),
    enabled: !!id,
    staleTime: STALE_NORMAL,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["meter_alerts", id],
    queryFn: () => tuyaIntegrationService.getAlerts(id!, false),
    enabled: !!id,
    staleTime: STALE_REALTIME,
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

  // Chart data
  const chartData = useMemo(() => {
    return [...readings].reverse().map(r => ({
      time: new Date(r.measured_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      Potência: r.power_w,
      Tensão: r.voltage_v,
      Corrente: r.current_a,
    }));
  }, [readings]);

  // Current switch state and extra DPs from raw_payload
  const extraDPs = useMemo(() => {
    const raw = (latestStatus as any)?.raw_payload;
    if (!raw?.dps) return { switchState: null as boolean | null, temperature: null as number | null, leakageCurrent: null as number | null, balanceEnergy: null as number | null };
    const dps: any[] = raw.dps;
    const sw = dps.find((dp: any) => dp.code === "switch");
    const temp = dps.find((dp: any) => dp.code === "temp_current");
    const leakage = dps.find((dp: any) => dp.code === "leakage_current");
    const balance = dps.find((dp: any) => dp.code === "balance_energy");
    return {
      switchState: sw ? !!sw.value : null,
      temperature: temp && typeof temp.value === "number" ? temp.value : null,
      leakageCurrent: leakage && typeof leakage.value === "number" ? leakage.value : null,
      balanceEnergy: balance && typeof balance.value === "number" ? (balance.value * 0.01) : null,
    };
  }, [latestStatus]);

  const switchState = extraDPs.switchState;

  async function handleSync() {
    if (!meter?.integration_config_id) return;
    setSyncing(true);
    try {
      await tuyaIntegrationService.syncDeviceStatus(meter.integration_config_id, id);
      toast({ title: "Leitura sincronizada com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_status_latest", id] });
      qc.invalidateQueries({ queryKey: ["meter_readings", id] });
    } catch (err: any) {
      toast({ title: "Erro ao sincronizar", description: err?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle() {
    if (!meter?.integration_config_id) return;
    const newValue = !switchState;
    setToggling(true);
    try {
      await tuyaIntegrationService.sendCommand(meter.integration_config_id, meter.external_device_id, [
        { code: "switch", value: newValue },
      ]);
      toast({ title: newValue ? "Medidor ligado" : "Medidor desligado" });
      // Refresh status
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["meter_status_latest", id] });
      }, 2000);
    } catch (err: any) {
      toast({ title: "Erro ao enviar comando", description: err?.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  async function handleDesvincular() {
    if (!activeLink) return;
    setUnlinking(true);
    try {
      await meterService.unlinkFromUnit(activeLink.id);
      toast({ title: "Medidor desvinculado com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_links", id] });
      qc.invalidateQueries({ queryKey: ["unit_meter_links"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  }

  async function handleRename() {
    if (!meter?.integration_config_id || !editName.trim()) return;
    setRenaming(true);
    try {
      await tuyaIntegrationService.renameDevice(meter.integration_config_id, meter.external_device_id, meter.id, editName.trim());
      toast({ title: "Nome atualizado com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_device", id] });
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Erro ao renomear", description: err?.message, variant: "destructive" });
    } finally {
      setRenaming(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-xl" />
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

  const powerVal = latestStatus?.power_w;
  const voltageVal = latestStatus?.voltage_v;
  const currentVal = latestStatus?.current_a;
  const energyVal = latestStatus?.energy_import_kwh;

  // Leitura inicial values from meter
  const leituraInicial03 = Number((meter as any).leitura_inicial_03) || 0;
  const leituraInicial103 = Number((meter as any).leitura_inicial_103) || 0;
  const energiaRelogio = leituraInicial03 > 0 && energyVal != null ? energyVal + leituraInicial03 : null;

  // Populate leitura form fields on first load
  useEffect(() => {
    if (meter && !leituraLoaded) {
      setLeitura03(String((meter as any).leitura_inicial_03 || 0));
      setLeitura103(String((meter as any).leitura_inicial_103 || 0));
      setLeituraData((meter as any).leitura_inicial_data || "");
      setLeituraObs((meter as any).leitura_inicial_observacao || "");
      setLeituraLoaded(true);
    }
  }, [meter, leituraLoaded]);

  const saveLeituraMutation = useMutation({
    mutationFn: () => meterService.updateLeituraInicial(meter!.id, {
      leitura_inicial_03: Number(leitura03) || 0,
      leitura_inicial_103: Number(leitura103) || 0,
      leitura_inicial_data: leituraData || null,
      leitura_inicial_observacao: leituraObs || null,
    }),
    onSuccess: () => {
      toast({ title: "Leitura inicial salva com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_device", id] });
    },
    onError: (err: any) => toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" }),
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/medidores")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      {/* Header §26 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 w-48 text-base font-bold"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRename} disabled={renaming}>
                    {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-success" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)} disabled={renaming}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-foreground">{meter.name}</h1>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditName(meter.name); setEditing(true); }}>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </>
              )}
              <StatusBadge variant={meter.online_status === "online" ? "success" : "destructive"} dot>
                {meter.online_status === "online" ? "Online" : "Offline"}
              </StatusBadge>
              {alerts.length > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" /> {alerts.length} alerta(s)
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {latestStatus?.measured_at
                ? `Última leitura: ${new Date(latestStatus.measured_at).toLocaleString("pt-BR")}`
                : "Sem leituras ainda"}
              {linkedUC && <> · UC: {linkedUC.nome}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || !meter.integration_config_id}>
            {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Sincronizar
          </Button>
          {switchState !== null && (
            <Button
              size="sm"
              variant={switchState ? "default" : "outline"}
              className={switchState ? "bg-success hover:bg-success/90 text-success-foreground" : "border-destructive text-destructive hover:bg-destructive/10"}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : switchState ? (
                <Power className="w-4 h-4 mr-1" />
              ) : (
                <PowerOff className="w-4 h-4 mr-1" />
              )}
              {switchState ? "Ligado" : "Desligado"}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards §27 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Zap}
          label="Potência Atual"
          value={powerVal != null ? (powerVal >= 1000 ? `${(powerVal / 1000).toFixed(2)} kW` : `${powerVal} W`) : "—"}
          color="primary"
        />
        <StatCard
          icon={Activity}
          label="Tensão"
          value={voltageVal != null ? `${voltageVal.toFixed(1)} V` : "—"}
          color="info"
        />
        <StatCard
          icon={Gauge}
          label="Corrente"
          value={currentVal != null ? `${currentVal.toFixed(2)} A` : "—"}
          color="warning"
        />
        <StatCard
          icon={BarChart3}
          label="Energia Total"
          value={energyVal != null ? `${energyVal.toFixed(2)} kWh` : "—"}
          color="success"
        />
      </div>
      {/* Extra DPs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Thermometer}
          label="Temperatura"
          value={extraDPs.temperature != null ? `${extraDPs.temperature} °C` : "—"}
          color="warning"
        />
        <StatCard
          icon={ShieldAlert}
          label="Corrente Fuga"
          value={extraDPs.leakageCurrent != null ? `${extraDPs.leakageCurrent} mA` : "—"}
          color="destructive"
        />
        <StatCard
          icon={BarChart3}
          label="Saldo Energia"
          value={extraDPs.balanceEnergy != null ? `${extraDPs.balanceEnergy.toFixed(2)} kWh` : "—"}
          color="info"
        />
        <StatCard
          icon={Activity}
          label="Frequência"
          value="60 Hz"
          color="success"
        />
      </div>

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Gráfico</TabsTrigger>
          <TabsTrigger value="readings">Leituras</TabsTrigger>
          <TabsTrigger value="commands">Comandos</TabsTrigger>
          <TabsTrigger value="info">Informações</TabsTrigger>
        </TabsList>

        {/* Chart Tab */}
        <TabsContent value="chart">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Histórico de Leituras
                </CardTitle>
                <div className="flex gap-1">
                  {(["24h", "7d", "30d"] as const).map(p => (
                    <Button
                      key={p}
                      variant={chartPeriod === p ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setChartPeriod(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradVoltage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCurrent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Potência" stroke="hsl(var(--primary))" fill="url(#gradPower)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Tensão" stroke="hsl(var(--info))" fill="url(#gradVoltage)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Corrente" stroke="hsl(var(--warning))" fill="url(#gradCurrent)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Nenhuma leitura disponível para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Readings Table Tab */}
        <TabsContent value="readings">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" /> Últimas 50 Leituras
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReadings.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-semibold text-foreground">Data/Hora</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Potência (W)</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Tensão (V)</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Corrente (A)</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Energia Imp. (kWh)</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Energia Exp. (kWh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReadings.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs">{new Date(r.measured_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-xs font-mono">{r.power_w?.toFixed(1) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.voltage_v?.toFixed(1) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.current_a?.toFixed(3) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.energy_import_kwh?.toFixed(2) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.energy_export_kwh?.toFixed(2) ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma leitura registrada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands">
          {meter.integration_config_id ? (
            <MeterCommandPanel
              configId={meter.integration_config_id}
              externalDeviceId={meter.external_device_id}
              meterId={meter.id}
            />
          ) : (
            <EmptyState
              icon={Terminal}
              title="Sem integração"
              description="Este medidor não está vinculado a uma integração Tuya."
            />
          )}
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gauge className="w-4 h-4" /> Informações do Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Modelo</p>
                    <p>{meter.model || "—"}</p>
                  </div>
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
                    <p className="text-xs text-muted-foreground">Device ID</p>
                    <p className="font-mono text-xs truncate">{meter.external_device_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Provider</p>
                    <Badge variant="outline" className="text-xs capitalize">{meter.provider}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Última Comunicação</p>
                    <p>{meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString("pt-BR") : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Vinculações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {linkedUC ? (
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">UC Vinculada</p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-sm font-medium" onClick={() => navigate(`/admin/ucs/${linkedUC.id}`)}>
                        {linkedUC.nome}
                      </Button>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10" disabled={unlinking}>
                          <Unlink className="w-4 h-4 mr-2" />
                          {unlinking ? "Desvinculando..." : "Desvincular UC"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[90vw] max-w-md">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desvincular medidor?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja desvincular o medidor "{meter.name}" da UC "{linkedUC.nome}"?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDesvincular} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Desvincular
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Nenhuma UC vinculada</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-meter alert config */}
          <div className="lg:col-span-2">
            <MeterAlertConfig meterId={meter.id} metadata={meter.metadata} latestStatus={latestStatus} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
