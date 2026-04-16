/**
 * EnergiaDashboard — Consolidated energy dashboard for all UCs.
 * §26-S1 header, §27-S1 KPI cards, §5-S1 chart, §4-S1 table.
 */
import { useMemo, useState } from "react";
import { formatBRLInteger } from "@/lib/formatters";
import { useNavigate } from "react-router-dom";
import { Zap, Building2, Wifi, AlertTriangle, Sun, TrendingDown, DollarSign, Battery, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

import { useUCsList, useGDGroups, useGDGroupBeneficiaries, useMeterDevicesStatus, useUnitMeterLinks } from "@/hooks/useEnergiaDashboard";
import { useEnergyAlerts } from "@/hooks/useEnergyAlerts";
import { useMonitorDashboardData } from "@/hooks/useMonitorDashboardData";

// ─── Custom Tooltip (§5-S1) ───
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{Number(p.value).toFixed(1)} kWh</span>
        </p>
      ))}
    </div>
  );
};

// ─── KPI Card (§27-S1) ───
function KpiCard({ icon: Icon, value, label, borderColor, iconBg }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  borderColor: string;
  iconBg: string;
}) {
  return (
    <Card className={`${borderColor} border-l-[3px] bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnergiaDashboard() {
  const navigate = useNavigate();
  const [gdGroupFilter, setGdGroupFilter] = useState<string>("all");

  // ─── Data hooks ───
  const { data: ucs = [], isLoading: loadingUCs } = useUCsList();
  const { data: gdGroups = [], isLoading: loadingGD } = useGDGroups();
  const { data: beneficiaries = [] } = useGDGroupBeneficiaries();
  const { data: meters = [] } = useMeterDevicesStatus();
  const { data: unitMeterLinks = [] } = useUnitMeterLinks();
  const { data: alerts = [], isLoading: loadingAlerts } = useEnergyAlerts({ pending: true });
  const { stats, readings, financials, isLoading: loadingMonitor } = useMonitorDashboardData();

  const isLoading = loadingUCs || loadingGD || loadingAlerts || loadingMonitor;

  // ─── Derived data ───
  const meterByUnit = useMemo(() => {
    const map = new Map<string, string>();
    for (const link of unitMeterLinks) {
      map.set(link.unit_id, link.meter_device_id);
    }
    return map;
  }, [unitMeterLinks]);

  const meterStatusMap = useMemo(() => {
    const map = new Map<string, { online_status: string | null; last_seen_at: string | null }>();
    for (const m of meters) {
      map.set(m.id, { online_status: m.online_status, last_seen_at: m.last_seen_at });
    }
    return map;
  }, [meters]);

  // KPIs
  const totalUCs = ucs.length;
  const onlineMeters = meters.filter(m => m.online_status === "online").length;
  const activeAlerts = alerts.length;
  const generationToday = stats?.energy_today_kwh || 0;
  const economyTotal = financials?.savings_month_brl || 0;

  // Chart data from readings
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    // Group readings by date
    const byDate = new Map<string, { generation: number; consumption: number; injection: number }>();
    for (const r of readings) {
      const date = r.date;
      if (!date) continue;
      const existing = byDate.get(date) || { generation: 0, consumption: 0, injection: 0 };
      existing.generation += r.energy_kwh || 0;
      byDate.set(date, existing);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
        Geração: v.generation,
        Consumo: v.consumption,
        Injeção: v.injection,
      }));
  }, [readings]);

  // UC table with meter status and alert counts
  const ucTableData = useMemo(() => {
    const alertCountByUnit = new Map<string, number>();
    for (const a of alerts) {
      if (a.unit_id) {
        alertCountByUnit.set(a.unit_id, (alertCountByUnit.get(a.unit_id) || 0) + 1);
      }
    }

    return ucs.map(uc => {
      const meterId = meterByUnit.get(uc.id);
      const meterStatus = meterId ? meterStatusMap.get(meterId) : null;
      const alertCount = alertCountByUnit.get(uc.id) || 0;
      return { ...uc, meterStatus: meterStatus?.online_status || "sem_medidor", alertCount };
    }).sort((a, b) => {
      // Alerts first, then offline, then online
      if (a.alertCount !== b.alertCount) return b.alertCount - a.alertCount;
      if (a.meterStatus === "offline" && b.meterStatus !== "offline") return -1;
      if (b.meterStatus === "offline" && a.meterStatus !== "offline") return 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [ucs, meterByUnit, meterStatusMap, alerts]);

  // GD groups enriched
  const gdGroupCards = useMemo(() => {
    return gdGroups.map(g => {
      const groupBenefs = beneficiaries.filter(b => b.gd_group_id === g.id);
      return {
        ...g,
        beneficiaryCount: groupBenefs.length,
      };
    });
  }, [gdGroups, beneficiaries]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 w-full">
        {/* Skeleton header */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
        {/* Skeleton chart */}
        <Skeleton className="h-64 w-full rounded-lg" />
        {/* Skeleton table */}
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      {/* ─── HEADER (§26-S1) ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard de Energia</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de todas as UCs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={gdGroupFilter} onValueChange={setGdGroupFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Grupo GD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os grupos</SelectItem>
              {gdGroups.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── KPI CARDS Row 1 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          value={totalUCs}
          label="UCs Ativas"
          borderColor="border-l-primary"
          iconBg="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={Wifi}
          value={onlineMeters}
          label="Medidores Online"
          borderColor="border-l-success"
          iconBg="bg-success/10 text-success"
        />
        <KpiCard
          icon={AlertTriangle}
          value={activeAlerts}
          label="Alertas Ativos"
          borderColor="border-l-destructive"
          iconBg="bg-destructive/10 text-destructive"
        />
        <KpiCard
          icon={Sun}
          value={`${generationToday.toFixed(1)} kWh`}
          label="Geração Hoje"
          borderColor="border-l-primary"
          iconBg="bg-primary/10 text-primary"
        />
      </div>

      {/* ─── KPI CARDS Row 2 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={TrendingDown}
          value={`${(stats?.energy_month_kwh || 0).toFixed(0)} kWh`}
          label="Geração Mês"
          borderColor="border-l-warning"
          iconBg="bg-warning/10 text-warning"
        />
        <KpiCard
          icon={Battery}
          value={`${onlineMeters} ativos`}
          label="Medidores Totais"
          borderColor="border-l-success"
          iconBg="bg-success/10 text-success"
        />
        <KpiCard
          icon={DollarSign}
          value={formatBRLInteger(economyTotal)}
          label="Economia Mês"
          borderColor="border-l-success"
          iconBg="bg-success/10 text-success"
        />
        <KpiCard
          icon={Users}
          value={gdGroups.length}
          label="Grupos GD"
          borderColor="border-l-info"
          iconBg="bg-info/10 text-info"
        />
      </div>

      {/* ─── CHART (§5-S1) ─── */}
      {chartData.length > 0 && (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Geração nos últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradGeneration" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradInjection" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Geração"
                  stroke="hsl(var(--primary))"
                  fill="url(#gradGeneration)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="Consumo"
                  stroke="hsl(var(--warning))"
                  fill="url(#gradConsumption)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="Injeção"
                  stroke="hsl(var(--success))"
                  fill="url(#gradInjection)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ─── UC TABLE (§4-S1) ─── */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Unidades Consumidoras</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Nome</TableHead>
                  <TableHead className="font-semibold text-foreground">Código UC</TableHead>
                  <TableHead className="font-semibold text-foreground">Papel GD</TableHead>
                  <TableHead className="font-semibold text-foreground">Medidor</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Alertas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ucTableData.map(uc => (
                  <TableRow
                    key={uc.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/ucs/${uc.id}?tab=overview`)}
                  >
                    <TableCell className="font-medium text-foreground">{uc.nome || "—"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">{uc.codigo_uc || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {uc.papel_gd || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {uc.meterStatus === "online" && (
                        <Badge className="bg-success/10 text-success border-success/20 text-xs">Online</Badge>
                      )}
                      {uc.meterStatus === "offline" && (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Offline</Badge>
                      )}
                      {uc.meterStatus === "sem_medidor" && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Sem medidor</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {uc.alertCount > 0 ? (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                          {uc.alertCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {ucTableData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma UC cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── GD GROUPS ─── */}
      {gdGroupCards.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-foreground mb-4">Grupos GD</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gdGroupCards.map(g => (
              <Card key={g.id} className="bg-card border-l-[3px] border-l-primary shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground">{g.nome}</p>
                    <Badge variant="outline" className="text-xs">{g.status || "ativo"}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Beneficiárias</p>
                      <p className="font-semibold text-foreground">{g.beneficiaryCount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Geradora</p>
                      <p className="font-semibold text-foreground">{g.uc_geradora_id ? "Sim" : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnergiaDashboard;
