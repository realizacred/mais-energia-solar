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
import { MeterAlarmPanel } from "./MeterAlarmPanel";
import { MeterPhaseStatus } from "./MeterPhaseStatus";
import { useLinkedUC, useDeleteMeter } from "@/hooks/useMeterDetail";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
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
  Save, CalendarDays, BookOpen, Info, Trash2,
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
  const [optimisticSwitch, setOptimisticSwitch] = useState<boolean | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteMeter() {
    if (!id) return;
    setDeleting(true);
    try {
      await supabase.from("meter_status_latest").delete().eq("meter_device_id", id);
      await supabase.from("meter_readings").delete().eq("meter_device_id", id);
      await supabase.from("meter_alerts").delete().eq("meter_device_id", id);
      await supabase.from("unit_meter_links").delete().eq("meter_device_id", id);
      const { error: delErr } = await supabase.from("meter_devices").delete().eq("id", id);
      if (delErr) throw delErr;
      toast({ title: "Medidor excluído com sucesso" });
      qc.invalidateQueries({ queryKey: ["meter_devices"] });
      navigate("/admin/medidores");
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

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
      time: new Date(r.measured_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
      Potência: r.power_w,
      Tensão: r.voltage_v,
      Corrente: r.current_a,
    }));
  }, [readings]);

  // Current switch state and extra DPs from raw_payload
  const extraDPs = useMemo(() => {
    const raw = (latestStatus as any)?.raw_payload;
    const dps: any[] = raw?.dps || [];
    const sw = dps.find((dp: any) => dp.code === "switch");
    return {
      switchState: sw ? !!sw.value : null,
      temperature: (latestStatus as any)?.temperature_c ?? null,
      leakageCurrent: (latestStatus as any)?.leakage_current_ma ?? null,
      balanceEnergy: (latestStatus as any)?.energy_balance_kwh ?? null,
      powerFactor: (latestStatus as any)?.power_factor ?? null,
      reactivePower: (latestStatus as any)?.reactive_power_kvar ?? null,
      statusA: (latestStatus as any)?.status_a ?? null,
      statusB: (latestStatus as any)?.status_b ?? null,
      statusC: (latestStatus as any)?.status_c ?? null,
      faultBitmap: (latestStatus as any)?.fault_bitmap ?? null,
      overCurrentCount: (latestStatus as any)?.over_current_count ?? null,
      lostCurrentCount: (latestStatus as any)?.lost_current_count ?? null,
      leakCount: (latestStatus as any)?.leak_count ?? null,
    };
  }, [latestStatus]);

  // Persist last known switch state so the button never disappears
  const [lastKnownSwitch, setLastKnownSwitch] = useState<boolean | null>(null);

  useEffect(() => {
    if (extraDPs.switchState !== null) {
      setLastKnownSwitch(extraDPs.switchState);
    }
  }, [extraDPs.switchState]);

  // Reset optimistic state when latestStatus updates with actual switch data
  useEffect(() => {
    if (optimisticSwitch !== null && extraDPs.switchState !== null) {
      setOptimisticSwitch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraDPs.switchState]);

  // Priority: optimistic > fresh DP > last known
  const switchState = optimisticSwitch !== null
    ? optimisticSwitch
    : extraDPs.switchState !== null
      ? extraDPs.switchState
      : lastKnownSwitch;

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
      // Optimistic update immediately
      setOptimisticSwitch(newValue);
      toast({ title: newValue ? "Comando: Ligar enviado" : "Comando: Desligar enviado" });
      // Wait for device to process, then sync real state from Tuya
      setTimeout(async () => {
        try {
          await tuyaIntegrationService.syncDeviceStatus(meter.integration_config_id!, id!);
        } catch (_) { /* ignore sync errors */ }
        setOptimisticSwitch(null); // Always clear optimistic after real sync
        qc.invalidateQueries({ queryKey: ["meter_status_latest", id] });
      }, 4000);
    } catch (err: any) {
      setOptimisticSwitch(null);
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

  /** Contextual voltage color based on ANEEL limits for 127V/220V networks */
  function getVoltageColor(v: number): "success" | "warning" | "destructive" | "info" {
    // Auto-detect network: if voltage > 170V it's 220V network
    if (v > 170) {
      if (v >= 201 && v <= 231) return "success";
      if ((v >= 191 && v < 201) || (v > 231 && v <= 240)) return "warning";
      return "destructive";
    }
    // 127V network
    if (v >= 110 && v <= 133) return "success";
    if ((v >= 100 && v < 110) || (v > 133 && v <= 139)) return "warning";
    return "destructive";
  }

  function getVoltageIndicator(v: number): string {
    const color = getVoltageColor(v);
    if (color === "success") return " ✓";
    if (color === "warning") return " ⚠️";
    return " ⚠️ Crítica";
  }

  const leituraInicial03 = Number((meter as any).leitura_inicial_03) || 0;
  const leituraInicial103 = Number((meter as any).leitura_inicial_103) || 0;
  const energiaRelogio = leituraInicial03 > 0 && energyVal != null ? energyVal + leituraInicial03 : null;

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
                ? `Última leitura: ${new Date(latestStatus.measured_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
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
              variant={switchState ? "default" : "destructive"}
              className={switchState ? "bg-success hover:bg-success/90 text-success-foreground" : ""}
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir medidor?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá o medidor <strong>{meter.name}</strong>, todas as leituras, alertas e vínculos associados. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteMeter}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
          value={voltageVal != null ? `${voltageVal.toFixed(1)} V${getVoltageIndicator(voltageVal)}` : "—"}
          color={voltageVal != null ? getVoltageColor(voltageVal) : "info"}
        />
        <StatCard
          icon={Gauge}
          label="Corrente"
          value={currentVal != null ? `${currentVal.toFixed(2)} A` : "—"}
          color="warning"
        />
        <TooltipProvider>
          <ShadTooltip>
            <TooltipTrigger asChild>
              <div>
                <StatCard
                  icon={BarChart3}
                  label={energiaRelogio != null ? "Energia Total (relógio)" : "Energia Total"}
                  value={energiaRelogio != null ? `${energiaRelogio.toFixed(2)} kWh` : energyVal != null ? `${energyVal.toFixed(2)} kWh` : "—"}
                  color="success"
                />
              </div>
            </TooltipTrigger>
            {energiaRelogio != null && (
              <TooltipContent>
                <p className="text-xs">Leitura Tuya ({energyVal?.toFixed(2)} kWh) + leitura inicial do relógio ({leituraInicial03} kWh)</p>
              </TooltipContent>
            )}
          </ShadTooltip>
        </TooltipProvider>
      </div>
      {/* Extra DPs row — expanded KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Fator de Potência"
          value={extraDPs.powerFactor != null ? `${extraDPs.powerFactor.toFixed(3)} pf` : "—"}
          color="info"
        />
        <StatCard
          icon={Thermometer}
          label="Temperatura"
          value={extraDPs.temperature != null ? `${extraDPs.temperature} °C` : "—"}
          color={extraDPs.temperature != null && extraDPs.temperature > 70 ? "destructive" : extraDPs.temperature != null && extraDPs.temperature > 50 ? "warning" : "success"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Corrente de Fuga"
          value={extraDPs.leakageCurrent != null ? `${extraDPs.leakageCurrent} mA` : "—"}
          color={extraDPs.leakageCurrent != null && extraDPs.leakageCurrent >= 30 ? "destructive" : extraDPs.leakageCurrent != null && extraDPs.leakageCurrent >= 10 ? "warning" : "success"}
        />
        <StatCard
          icon={BarChart3}
          label="Potência Reativa"
          value={extraDPs.reactivePower != null ? `${extraDPs.reactivePower.toFixed(1)} kVar` : "—"}
          color="primary"
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
                        <TableHead className="text-xs font-semibold text-foreground">FP</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Reg 03 — Consumo (kWh)</TableHead>
                        <TableHead className="text-xs font-semibold text-foreground">Reg 103 — Injeção (kWh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReadings.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs">{new Date(r.measured_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
                          <TableCell className="text-xs font-mono">{r.power_w?.toFixed(1) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.voltage_v?.toFixed(1) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.current_a?.toFixed(3) ?? "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.power_factor?.toFixed(3) ?? "—"}</TableCell>
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
          {/* Alarms & Phase Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MeterAlarmPanel
              faultBitmap={extraDPs.faultBitmap}
              overCurrentCount={extraDPs.overCurrentCount}
              lostCurrentCount={extraDPs.lostCurrentCount}
              leakCount={extraDPs.leakCount}
            />
            <MeterPhaseStatus statusA={extraDPs.statusA} statusB={extraDPs.statusB} statusC={extraDPs.statusC} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Gauge className="w-4 h-4" /> Informações do Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <p>{meter.last_seen_at ? new Date(meter.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</p>
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

          {/* Leitura Inicial do Relógio Físico */}
          <div className="lg:col-span-2">
            <section className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-primary" />
                Leitura Inicial do Relógio Físico
              </p>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>O medidor Tuya começa a contar do <strong className="text-foreground">zero</strong> quando é instalado. Para que o sistema mostre o valor real do relógio físico, informe aqui a leitura que o relógio marcava no momento da instalação.</p>
                  <p><strong className="text-foreground">Registro 03</strong> = <span className="font-mono">total_forward_energy</span> = Energia consumida da rede (importação)</p>
                  <p><strong className="text-foreground">Registro 103</strong> = <span className="font-mono">reverse_energy_total</span> = Energia injetada na rede (exportação/geração excedente)</p>
                  <p>⚠️ Não é possível alterar o contador do medidor via comando — ele é somente leitura. O offset é aplicado apenas na exibição.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    <span className="font-semibold text-foreground">Reg 03</span> — Energia Consumida (kWh)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={leitura03}
                    onChange={(e) => setLeitura03(e.target.value)}
                    placeholder="Ex: 1523.45"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">DP: total_forward_energy — quanto o local consumiu da rede</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    <span className="font-semibold text-foreground">Reg 103</span> — Energia Injetada (kWh)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={leitura103}
                    onChange={(e) => setLeitura103(e.target.value)}
                    placeholder="Ex: 55.00"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">DP: reverse_energy_total — quanto o sistema solar injetou na rede</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Data da leitura inicial</label>
                  <DateInput
                    value={leituraData}
                    onChange={setLeituraData}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Observação</label>
                  <Textarea
                    value={leituraObs}
                    onChange={(e) => setLeituraObs(e.target.value)}
                    placeholder="Ex: Relógio físico marcava 1523.45 kWh (03) e 55.00 kWh (103) no dia da instalação"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveLeituraMutation.mutate()}
                  disabled={saveLeituraMutation.isPending}
                >
                  {saveLeituraMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Salvar leitura inicial
                </Button>
              </div>
            </section>
          </div>

          {/* Per-meter alert config */}
          <div className="lg:col-span-2">
            <MeterAlertConfig meterId={meter.id} metadata={meter.metadata} latestStatus={latestStatus} configId={meter.integration_config_id} externalDeviceId={meter.external_device_id} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
