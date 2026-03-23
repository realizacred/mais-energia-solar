/**
 * UCOverviewTab — Dashboard overview for a UC.
 * Shows KPI cards, generation vs consumption chart, device status, recent invoices, timeline.
 * §27: KPI cards via StatCard, §5: Recharts, §4: empty states, §23: staleTime.
 */
import { useQuery } from "@tanstack/react-query";
import { formatDecimalBR } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { meterService } from "@/services/meterService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  Zap, Sun, BarChart3, Calendar, Battery, Activity,
  Gauge, ArrowRight, FileText, Clock, BarChart2, ArrowUpRight, ArrowDownRight
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
  /** monitor_plants.id — used for V2 metrics queries */
  plantId?: string | null;
  meterName?: string | null;
  meterOnline?: string | null;
  plantName?: string | null;
  plantCapacityKwp?: number | null;
  proximaLeituraData?: string | null;
}

const STALE_5M = 1000 * 60 * 2; // 2 min for fresher UC data
const STALE_2M = 1000 * 60 * 1; // 1 min for real-time metrics

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
  ucId, meterId, plantId, meterName, meterOnline, plantName, plantCapacityKwp, proximaLeituraData,
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
  // plantId = monitor_plants.id; use RPC get_plant_metrics for V2 data
  const chartDays = chartPeriod === "7d" ? 7 : chartPeriod === "30d" ? 30 : 90;
  const effectivePlantId = plantId;
  const { data: plantMetrics = [], isLoading: loadingPlantMetrics } = useQuery({
    queryKey: ["uc_overview_plant_metrics", effectivePlantId, chartDays],
    queryFn: async () => {
      const since = subDays(new Date(), chartDays).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_plant_metrics", {
        p_plant_id: effectivePlantId!,
        p_date_from: since,
        p_date_to: today,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        date: r.date,
        energy_kwh: r.energy_kwh ?? 0,
        power_kw: r.peak_power_kw ?? 0,
      }));
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
        .select("measured_at, energy_import_kwh, energy_export_kwh")
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

  // --- Today's meter delta (consumption + injection for today) ---
  const { data: todayMeterDelta } = useQuery({
    queryKey: ["uc_overview_today_delta", meterId],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      // Get first reading of today
      const { data: firstReading } = await supabase
        .from("meter_readings")
        .select("energy_import_kwh, energy_export_kwh")
        .eq("meter_device_id", meterId!)
        .gte("measured_at", todayStart.toISOString())
        .order("measured_at", { ascending: true })
        .limit(1);
      // Get latest reading
      const { data: lastReading } = await supabase
        .from("meter_readings")
        .select("energy_import_kwh, energy_export_kwh")
        .eq("meter_device_id", meterId!)
        .gte("measured_at", todayStart.toISOString())
        .order("measured_at", { ascending: false })
        .limit(1);
      if (!firstReading?.length || !lastReading?.length) return null;
      const first = firstReading[0];
      const last = lastReading[0];
      return {
        consumoHoje: Math.max(0, Number(last.energy_import_kwh || 0) - Number(first.energy_import_kwh || 0)),
        injecaoHoje: Math.max(0, Number(last.energy_export_kwh || 0) - Number(first.energy_export_kwh || 0)),
      };
    },
    enabled: !!meterId,
    staleTime: STALE_2M,
  });

  // --- Unit credits sum for Saldo GD ---
  const { data: creditSum } = useQuery({
    queryKey: ["uc_overview_credit_sum", ucId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_credits")
        .select("quantidade_kwh")
        .eq("unit_id", ucId);
      if (error) throw error;
      return (data || []).reduce((sum, c) => sum + Number(c.quantidade_kwh || 0), 0);
    },
    staleTime: STALE_5M,
  });

  // --- Build chart data ---
  const chartData = useMemo(() => {
    const importByDay: Record<string, number[]> = {};
    const exportByDay: Record<string, number[]> = {};
    meterReadings.forEach((r: any) => {
      const day = r.measured_at?.slice(0, 10);
      if (!day) return;
      if (!importByDay[day]) importByDay[day] = [];
      if (!exportByDay[day]) exportByDay[day] = [];
      importByDay[day].push(Number(r.energy_import_kwh) || 0);
      exportByDay[day].push(Number(r.energy_export_kwh) || 0);
    });

    const consumptionByDay: Record<string, number> = {};
    const injectionByDay: Record<string, number> = {};
    Object.entries(importByDay).forEach(([day, vals]) => {
      consumptionByDay[day] = Math.max(0, Math.max(...vals) - Math.min(...vals));
    });
    Object.entries(exportByDay).forEach(([day, vals]) => {
      injectionByDay[day] = Math.max(0, Math.max(...vals) - Math.min(...vals));
    });

    const generationByDay: Record<string, number> = {};
    plantMetrics.forEach((m: any) => {
      generationByDay[m.date] = Number(m.energy_kwh) || 0;
    });

    const allDays = new Set([...Object.keys(consumptionByDay), ...Object.keys(generationByDay), ...Object.keys(injectionByDay)]);
    return Array.from(allDays)
      .sort()
      .map((day) => {
        const gen = generationByDay[day] || 0;
        const cons = consumptionByDay[day] || 0;
        const inj = injectionByDay[day] || 0;
        return {
          date: format(parseISO(day), "dd/MM", { locale: ptBR }),
          _realGeração: gen,
          _realConsumo: cons,
          _realInjeção: inj,
          _displayGeração: gen === 0 ? 0.3 : gen,
          _displayConsumo: cons === 0 ? 0.3 : cons,
          _displayInjeção: inj === 0 ? 0.3 : inj,
        };
      });
  }, [meterReadings, plantMetrics]);

  // --- KPI values ---
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayGeneration = plantMetrics.find((m: any) => m.date === todayStr);
  const latestInvoice = recentInvoices[0];
  
  // Saldo GD: créditos manuais + saldo da última fatura
  const invoiceSaldo = latestInvoice?.current_balance_kwh ?? 0;
  const totalCredits = creditSum ?? 0;
  const saldoGD = (invoiceSaldo + totalCredits) || null;

  // Consumo e Injeção hoje (delta do medidor)
  const consumoHoje = todayMeterDelta?.consumoHoje ?? null;
  const injecaoHoje = todayMeterDelta?.injecaoHoje ?? null;

  const proximaDias = proximaLeituraData
    ? Math.ceil((new Date(proximaLeituraData).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const fmtKwh = (v: number | null) =>
    v != null ? `${formatDecimalBR(v, 1)} kWh` : "—";

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1 — KPI Cards §27 via StatCard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {loadingMeter ? (
          <Card className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-20" /></Card>
        ) : (
          <StatCard
            icon={Zap}
            label="Potência Atual"
            value={meterStatus?.power_w != null ? `${Number(meterStatus.power_w).toLocaleString("pt-BR")} W` : "—"}
            color="primary"
          />
        )}

        <StatCard
          icon={Activity}
          label="Status do Sistema"
          value={!meterId ? "Sem medidor" : (meterStatus?.online_status === "online" || meterOnline === "online") ? "Online" : "Offline"}
          color={!meterId ? "muted" : (meterStatus?.online_status === "online" || meterOnline === "online") ? "success" : "destructive"}
        />

        {loadingPlantMetrics ? (
          <Card className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-20" /></Card>
        ) : (
          <StatCard
            icon={Sun}
            label="Geração Hoje"
            value={todayGeneration ? fmtKwh(Number(todayGeneration.energy_kwh)) : "0,0 kWh"}
            color="warning"
          />
        )}

        {loadingMeter ? (
          <Card className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-20" /></Card>
        ) : (
          <StatCard
            icon={BarChart3}
            label="Consumo Hoje"
            value={fmtKwh(consumoHoje)}
            color="info"
          />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ArrowUpRight}
          label="Injeção Hoje"
          value={fmtKwh(injecaoHoje)}
          color="warning"
        />

        <StatCard
          icon={Battery}
          label="Saldo GD"
          value={fmtKwh(saldoGD)}
          color="success"
        />

        <StatCard
          icon={Calendar}
          label="Próxima Leitura"
          value={proximaLeituraData ? format(parseISO(proximaLeituraData), "dd/MM/yyyy") : "—"}
          color={proximaDias != null && proximaDias <= 0 ? "destructive" : proximaDias != null && proximaDias < 7 ? "warning" : "muted"}
          subtitle={proximaDias != null && proximaDias <= 0 ? "⚠ Leitura atrasada" : undefined}
        />

        <StatCard
          icon={ArrowDownRight}
          label="Sobra do Dia"
          value={todayGeneration && consumoHoje != null
            ? fmtKwh(Math.max(0, Number(todayGeneration.energy_kwh) - consumoHoje))
            : "—"}
          color="success"
        />
      </div>

      {/* SEÇÃO 2 — Gráfico Geração vs Consumo vs Injeção */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Geração vs Consumo vs Injeção
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
          {/* Series toggles */}
          <div className="flex flex-wrap gap-3 mt-2">
            {([
              { key: "geracao" as const, label: "Geração", color: "bg-success" },
              { key: "consumo" as const, label: "Consumo", color: "bg-destructive" },
              { key: "injecao" as const, label: "Injeção", color: "bg-warning" },
            ]).map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setChartSeries(s => ({ ...s, [key]: !s[key] }))}
                  className={`w-3.5 h-3.5 min-h-0 min-w-0 p-0 rounded-sm border border-border transition-colors ${chartSeries[key] ? color : "bg-muted"}`}
                />
                {label}
              </label>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {(loadingPlantMetrics || loadingReadings) ? (
            <Skeleton className="h-[260px] w-full rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">Aguardando dados</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Os gráficos serão exibidos após as primeiras leituras do medidor e do inversor.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
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
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                {chartSeries.geracao && (
                  <Bar dataKey="_displayGeração" name="Geração" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                )}
                {chartSeries.consumo && (
                  <Bar dataKey="_displayConsumo" name="Consumo" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                )}
                {chartSeries.injecao && (
                  <Bar dataKey="_displayInjeção" name="Injeção" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 3 — Status dos Dispositivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Card Medidor */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Gauge className="w-4 h-4 text-primary" /> Medidor
              </CardTitle>
              {meterId ? (
                <Badge variant="outline" className={`text-xs ${meterStatus?.online_status === "online" ? "border-success text-success" : "border-destructive text-destructive"}`}>
                  {meterStatus?.online_status === "online" ? "Online" : "Offline"}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Sem medidor</Badge>
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
                      {meterStatus?.measured_at ? new Date(meterStatus.measured_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "—"}
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
                      ? `${formatDecimalBR(Number(todayGeneration.energy_kwh), 1)} kWh`
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
                      {inv.status === "processed" ? "Processada" : inv.status === "received" ? "Recebida" : inv.status === "pending" ? "Pendente" : inv.status === "validated" ? "Validada" : inv.status === "error" ? "Erro" : inv.status === "pending_review" ? "Em revisão" : inv.status === "failed" ? "Falhou" : inv.status === "incomplete" ? "Incompleta" : inv.status === "divergent" ? "Divergente" : inv.status || "—"}
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
              {new Date(ev.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
