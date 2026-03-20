/**
 * UCOverviewTab — Dashboard overview for a UC.
 * Shows KPI cards, generation vs consumption chart, device status, recent invoices, timeline.
 * §27: KPI cards, §5: Recharts, §4: empty states, §23: staleTime.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meterService } from "@/services/meterService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap, Sun, BarChart3, Calendar, Battery, Activity,
  Gauge, ArrowRight, FileText, Clock, BarChart2, Link2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  ucId: string;
  meterId?: string | null;
  plantId?: string | null;
  /** Resolved solar_plants.id (from monitor_plants.legacy_plant_id) for metrics queries */
  solarPlantId?: string | null;
  meterName?: string | null;
  meterOnline?: string | null;
  plantName?: string | null;
  plantCapacityKwp?: number | null;
  proximaLeituraData?: string | null;
}

const STALE_5M = 1000 * 60 * 5;
const STALE_2M = 1000 * 60 * 2;

// §5: Custom tooltip
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-muted-foreground">
        Geração: <span className="font-semibold text-foreground">{Number(row?._realGeração ?? 0).toFixed(2)} kWh</span>
      </p>
      <p className="text-muted-foreground">
        Consumo: <span className="font-semibold text-foreground">{Number(row?._realConsumo ?? 0).toFixed(2)} kWh</span>
      </p>
      <p className="text-muted-foreground">
        Injeção: <span className="font-semibold text-foreground">{Number(row?._realInjeção ?? 0).toFixed(2)} kWh</span>
      </p>
    </div>
  );
};

export function UCOverviewTab({
  ucId, meterId, plantId, solarPlantId, meterName, meterOnline, plantName, plantCapacityKwp, proximaLeituraData,
}: Props) {
  const navigate = useNavigate();
  const [chartPeriod, setChartPeriod] = useState<"7d" | "30d" | "3m">("30d");
  const [chartSeries, setChartSeries] = useState({ geracao: true, consumo: true, injecao: true });

  // --- Meter status latest ---
  const { data: meterStatus, isLoading: loadingMeter } = useQuery({
    queryKey: ["uc_overview_meter_status", meterId],
    queryFn: () => meterService.getStatusLatest(meterId!),
    enabled: !!meterId,
    staleTime: STALE_2M,
  });

  // --- Plant metrics daily (for chart + KPI) ---
  // solarPlantId = solar_plants.id (resolved from monitor_plants.legacy_plant_id in parent)
  const chartDays = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : 90;
  const effectivePlantId = solarPlantId || plantId;
  const { data: plantMetrics = [], isLoading: loadingPlantMetrics } = useQuery({
    queryKey: ["uc_overview_plant_metrics", effectivePlantId, chartDays],
    queryFn: async () => {
      const since = subDays(new Date(), chartDays).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("solar_plant_metrics_daily")
        .select("date, energy_kwh, power_kw")
        .eq("plant_id", effectivePlantId!)
        .gte("date", since)
        .order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!effectivePlantId,
    staleTime: STALE_5M,
  });

  // --- Meter readings daily (for chart) ---
  const { data: meterReadings = [], isLoading: loadingReadings } = useQuery({
    queryKey: ["uc_overview_meter_readings", meterId, chartDays],
    queryFn: async () => {
      const since = subDays(new Date(), chartDays).toISOString();
      const { data, error } = await supabase
        .from("meter_readings")
        .select("measured_at, energy_import_kwh")
        .eq("meter_device_id", meterId!)
        .gte("measured_at", since)
        .order("measured_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meterId,
    staleTime: STALE_5M,
  });

  // --- Latest invoices (3) ---
  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["uc_overview_invoices", ucId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_invoices")
        .select("id, reference_month, reference_year, total_amount, energy_consumed_kwh, compensated_kwh, current_balance_kwh, status, due_date")
        .eq("unit_id", ucId)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: STALE_5M,
  });

  // --- Build chart data ---
  const chartData = useMemo(() => {
    // Group meter readings by day to compute daily consumption
    const readingsByDay: Record<string, number[]> = {};
    meterReadings.forEach((r: any) => {
      const day = r.measured_at?.slice(0, 10);
      if (!day) return;
      if (!readingsByDay[day]) readingsByDay[day] = [];
      readingsByDay[day].push(Number(r.energy_import_kwh) || 0);
    });

    const consumptionByDay: Record<string, number> = {};
    Object.entries(readingsByDay).forEach(([day, vals]) => {
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      consumptionByDay[day] = Math.max(0, max - min);
    });

    const generationByDay: Record<string, number> = {};
    plantMetrics.forEach((m: any) => {
      generationByDay[m.date] = Number(m.energy_kwh) || 0;
    });

    // Merge all days
    const allDays = new Set([...Object.keys(consumptionByDay), ...Object.keys(generationByDay)]);
    return Array.from(allDays)
      .sort()
      .map((day) => {
        const gen = generationByDay[day] || 0;
        const cons = consumptionByDay[day] || 0;
        return {
          date: format(parseISO(day), "dd/MM", { locale: ptBR }),
          Geração: gen,
          Consumo: cons,
          // Keep real values for tooltip
          _realGeração: gen,
          _realConsumo: cons,
          // Show a tiny bar for zero values so both series are always visible
          _displayGeração: gen === 0 ? 0.3 : gen,
          _displayConsumo: cons === 0 ? 0.3 : cons,
        };
      });
  }, [meterReadings, plantMetrics]);

  // --- KPI values ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayGeneration = plantMetrics.find((m: any) => m.date === todayStr);
  const latestInvoice = recentInvoices[0];
  const saldoGD = latestInvoice?.current_balance_kwh ?? latestInvoice?.compensated_kwh ?? null;

  const proximaDias = proximaLeituraData
    ? Math.ceil((new Date(proximaLeituraData).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1 — KPI Cards §27 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Potência atual */}
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              {loadingMeter ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {meterStatus?.power_w != null ? `${Number(meterStatus.power_w).toLocaleString("pt-BR")}` : "—"}
                  <span className="text-sm font-normal text-muted-foreground ml-1">W</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Potência Atual</p>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className={`border-l-[3px] ${meterOnline === "online" || meterStatus?.online_status === "online" ? "border-l-success" : "border-l-destructive"} bg-card shadow-sm hover:shadow-md transition-shadow`}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${meterOnline === "online" || meterStatus?.online_status === "online" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${meterStatus?.online_status === "online" ? "border-success text-success" : "border-destructive text-destructive"}`}>
                  Medidor: {meterStatus?.online_status || meterOnline || "—"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Status do Sistema</p>
            </div>
          </CardContent>
        </Card>

        {/* Geração hoje */}
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              {loadingPlantMetrics ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {todayGeneration ? Number(todayGeneration.energy_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "0,0"}
                  <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Geração Hoje</p>
            </div>
          </CardContent>
        </Card>

        {/* Consumo acumulado */}
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              {loadingMeter ? <Skeleton className="h-8 w-24" /> : (
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {meterStatus?.energy_import_kwh != null ? Number(meterStatus.energy_import_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
                  <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">Consumo Acumulado</p>
            </div>
          </CardContent>
        </Card>

        {/* Próxima leitura */}
        <Card className={`border-l-[3px] ${proximaDias != null && proximaDias < 7 ? "border-l-warning" : "border-l-muted"} bg-card shadow-sm hover:shadow-md transition-shadow`}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${proximaDias != null && proximaDias < 7 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {proximaLeituraData
                  ? format(parseISO(proximaLeituraData), "dd/MM/yyyy")
                  : "Não agendada"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Próxima Leitura</p>
            </div>
          </CardContent>
        </Card>

        {/* Saldo GD */}
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <Battery className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {saldoGD != null ? Number(saldoGD).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}
                <span className="text-sm font-normal text-muted-foreground ml-1">kWh</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Saldo GD</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 2 — Gráfico Geração vs Consumo */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Geração vs Consumo
            </CardTitle>
            <div className="flex gap-1">
              {(["7d", "30d", "3m"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={chartPeriod === p ? "default" : "outline"}
                  className="text-xs h-7 px-2.5"
                  onClick={() => setChartPeriod(p)}
                >
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "3 meses"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(loadingPlantMetrics || loadingReadings) ? (
            <Skeleton className="h-[220px] w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">Aguardando dados</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Os gráficos serão exibidos após as primeiras leituras do medidor e do inversor.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Bar dataKey="_displayGeração" name="Geração" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="_displayConsumo" name="Consumo" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Status dos Dispositivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Medidor */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" /> Medidor
              </CardTitle>
              {meterId && (
                <Badge variant="outline" className={`text-xs ${meterStatus?.online_status === "online" ? "border-success text-success" : "border-destructive text-destructive"}`}>
                  {meterStatus?.online_status === "online" ? "Online" : "Offline"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!meterId ? (
              <p className="text-sm text-muted-foreground">Nenhum medidor vinculado.</p>
            ) : loadingMeter ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium truncate ml-2">{meterName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última leitura</span>
                  <span className="font-mono text-xs">
                    {meterStatus?.measured_at ? format(new Date(meterStatus.measured_at), "dd/MM HH:mm") : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Potência</span>
                  <span>{meterStatus?.power_w != null ? `${Number(meterStatus.power_w).toLocaleString("pt-BR")} W` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tensão</span>
                  <span>{meterStatus?.voltage_v != null ? `${Number(meterStatus.voltage_v).toFixed(1)} V` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Temperatura</span>
                  <span>{meterStatus?.temperature_c != null ? `${Number(meterStatus.temperature_c).toFixed(1)} °C` : "—"}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs gap-1"
                  onClick={() => navigate(`/admin/medidores/${meterId}`)}
                >
                  Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Usina */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sun className="w-4 h-4 text-warning" /> Usina
              </CardTitle>
              {plantId && (
                <Badge variant="outline" className="text-xs border-success text-success">
                  Vinculada
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!plantId ? (
              <p className="text-sm text-muted-foreground">Nenhuma usina vinculada.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium truncate ml-2">{plantName || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geração hoje</span>
                  <span>
                    {todayGeneration
                      ? `${Number(todayGeneration.energy_kwh).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} kWh`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacidade</span>
                  <span>{plantCapacityKwp ? `${plantCapacityKwp} kWp` : "—"}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs gap-1"
                  onClick={() => navigate(`/admin/monitoramento/usinas/${plantId}`)}
                >
                  Ver detalhes <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 4 — Últimas Faturas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Últimas Faturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">Nenhuma fatura</p>
              <p className="text-xs text-muted-foreground mt-1">As faturas aparecerão aqui após o processamento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {String(inv.reference_month).padStart(2, "0")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {String(inv.reference_month).padStart(2, "0")}/{inv.reference_year}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.energy_consumed_kwh != null ? `${Number(inv.energy_consumed_kwh).toLocaleString("pt-BR")} kWh` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono">
                      {inv.total_amount != null
                        ? `R$ ${Number(inv.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {inv.status === "processed" ? "Processada" : inv.status === "pending" ? "Pendente" : inv.status || "—"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 5 — Timeline simples */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineSection ucId={ucId} meterId={meterId} plantId={plantId} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Mini-timeline que busca últimos eventos de faturas, leituras, vínculos */
function TimelineSection({ ucId, meterId, plantId }: { ucId: string; meterId?: string | null; plantId?: string | null }) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["uc_overview_timeline", ucId, meterId, plantId],
    queryFn: async () => {
      const items: { date: string; label: string; icon: string }[] = [];

      // Recent invoices
      const { data: invs } = await supabase
        .from("unit_invoices")
        .select("id, created_at, reference_month, reference_year")
        .eq("unit_id", ucId)
        .order("created_at", { ascending: false })
        .limit(2);
      invs?.forEach((i: any) => {
        items.push({
          date: i.created_at,
          label: `Fatura ${String(i.reference_month).padStart(2, "0")}/${i.reference_year} recebida`,
          icon: "invoice",
        });
      });

      // Meter link
      if (meterId) {
        const { data: ml } = await supabase
          .from("unit_meter_links")
          .select("created_at")
          .eq("unit_id", ucId)
          .eq("meter_device_id", meterId)
          .order("created_at", { ascending: false })
          .limit(1);
        ml?.forEach((l: any) => {
          items.push({ date: l.created_at, label: "Medidor vinculado", icon: "meter" });
        });
      }

      // Plant link
      if (plantId) {
        const { data: pl } = await supabase
          .from("unit_plant_links")
          .select("created_at")
          .eq("unit_id", ucId)
          .eq("plant_id", plantId)
          .order("created_at", { ascending: false })
          .limit(1);
        pl?.forEach((l: any) => {
          items.push({ date: l.created_at, label: "Usina vinculada", icon: "plant" });
        });
      }

      // Last meter reading
      if (meterId) {
        const { data: mr } = await supabase
          .from("meter_readings")
          .select("measured_at")
          .eq("meter_device_id", meterId)
          .order("measured_at", { ascending: false })
          .limit(1);
        mr?.forEach((r: any) => {
          items.push({ date: r.measured_at, label: "Leitura do medidor registrada", icon: "reading" });
        });
      }

      return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
    },
    staleTime: STALE_5M,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade registrada.</p>
    );
  }

  const iconMap: Record<string, React.ReactNode> = {
    invoice: <FileText className="w-3.5 h-3.5" />,
    meter: <Gauge className="w-3.5 h-3.5" />,
    plant: <Sun className="w-3.5 h-3.5" />,
    reading: <Activity className="w-3.5 h-3.5" />,
  };

  return (
    <div className="space-y-3">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            {iconMap[ev.icon] || <Clock className="w-3.5 h-3.5" />}
          </div>
          <div>
            <p className="text-sm text-foreground">{ev.label}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(ev.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
