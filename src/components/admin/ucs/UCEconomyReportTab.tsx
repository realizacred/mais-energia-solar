/**
 * UCEconomyReportTab — Monthly economy report for a UC based on invoice data.
 * Shows how much the client saved with solar energy (compensated kWh × tariff).
 * §27: KPI cards, §5: Recharts, §23: staleTime.
 */
import { useMemo, useState, useCallback } from "react";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { invoiceService, type UnitInvoice } from "@/services/invoiceService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart,
} from "recharts";
import { TrendingUp, DollarSign, Zap, Leaf, BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  unitId: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** §5: Custom tooltip */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? p.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : p.value}
            {p.name.includes("R$") ? "" : p.unit === "kwh" ? " kWh" : ""}
          </span>
        </p>
      ))}
    </div>
  );
};

const BANDEIRA_LABELS: Record<string, string> = {
  verde: "Verde",
  amarela: "Amarela",
  vermelha_1: "Vermelha 1",
  vermelha_2: "Vermelha 2",
};

const BANDEIRA_COLORS: Record<string, string> = {
  verde: "border-success text-success",
  amarela: "border-warning text-warning",
  vermelha_1: "border-destructive text-destructive",
  vermelha_2: "border-destructive text-destructive",
};

// Default tariff if UC doesn't have one configured (R$/kWh)
const DEFAULT_TARIFF = 0.85;

export function UCEconomyReportTab({ unitId }: Props) {
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["unit_invoices", unitId],
    queryFn: () => invoiceService.listByUnit(unitId),
    staleTime: 1000 * 60 * 5,
  });

  // Fetch tenant tariff from calculadora_config
  const { data: calcConfig } = useQuery({
    queryKey: ["calc_config_tariff"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calculadora_config")
        .select("tarifa_media_kwh")
        .limit(1)
        .maybeSingle();
      return data as { tarifa_media_kwh: number } | null;
    },
    staleTime: 1000 * 60 * 15,
  });

  const tariff = calcConfig?.tarifa_media_kwh || DEFAULT_TARIFF;

  // Available years from invoices
  const years = useMemo(() => {
    const ys = [...new Set(invoices.map(i => i.reference_year))].sort((a, b) => b - a);
    if (ys.length === 0) ys.push(new Date().getFullYear());
    return ys;
  }, [invoices]);

  // Filter invoices for selected year
  const yearInvoices = useMemo(
    () => invoices.filter(i => i.reference_year === Number(selectedYear)).sort((a, b) => a.reference_month - b.reference_month),
    [invoices, selectedYear]
  );

  // Monthly data for chart + table
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const inv = yearInvoices.find(f => f.reference_month === month);
      const consumed = inv?.energy_consumed_kwh || 0;
      const compensated = inv?.compensated_kwh || 0;
      const injected = inv?.energy_injected_kwh || 0;
      const totalAmount = inv?.total_amount || 0;
      const economyKwh = compensated;
      const economyBrl = economyKwh * tariff;
      // What the client would pay without solar
      const fullBill = (consumed + compensated) * tariff;
      const savingPct = fullBill > 0 ? (economyBrl / fullBill) * 100 : 0;

      return {
        month,
        label: MONTHS[i],
        consumed,
        injected,
        compensated,
        totalAmount,
        economyKwh,
        economyBrl: Math.round(economyBrl * 100) / 100,
        fullBill: Math.round(fullBill * 100) / 100,
        savingPct: Math.round(savingPct * 10) / 10,
        bandeira: inv?.bandeira_tarifaria || null,
        hasData: !!inv,
      };
    });
  }, [yearInvoices, tariff]);

  // KPI totals
  const totals = useMemo(() => {
    const withData = monthlyData.filter(m => m.hasData);
    const totalEconomyBrl = withData.reduce((s, m) => s + m.economyBrl, 0);
    const totalEconomyKwh = withData.reduce((s, m) => s + m.economyKwh, 0);
    const totalConsumed = withData.reduce((s, m) => s + m.consumed, 0);
    const totalCompensated = withData.reduce((s, m) => s + m.compensated, 0);
    const totalFullBill = withData.reduce((s, m) => s + m.fullBill, 0);
    const avgSaving = totalFullBill > 0 ? (totalEconomyBrl / totalFullBill) * 100 : 0;
    // CO2 avoided: ~0.075 kg CO2/kWh (Brazil grid average)
    const co2AvoidedKg = totalCompensated * 0.075;
    return {
      totalEconomyBrl: Math.round(totalEconomyBrl * 100) / 100,
      totalEconomyKwh: Math.round(totalEconomyKwh * 100) / 100,
      totalConsumed: Math.round(totalConsumed * 100) / 100,
      totalCompensated: Math.round(totalCompensated * 100) / 100,
      avgSaving: Math.round(avgSaving * 10) / 10,
      co2AvoidedKg: Math.round(co2AvoidedKg * 10) / 10,
      monthsWithData: withData.length,
    };
  }, [monthlyData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de economia"
        description="Registre faturas na aba Faturas para visualizar o relatório de economia desta UC."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Relatório de Economia
        </h3>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards — §27 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                R$ {totals.totalEconomyBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Economia total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                {totals.totalCompensated.toLocaleString("pt-BR")} kWh
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Compensado</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                {totals.avgSaving}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Economia média</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Leaf className="w-4 h-4" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-foreground leading-none">
                {totals.co2AvoidedKg.toLocaleString("pt-BR")} kg
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">CO₂ evitado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart — §5 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Economia Mensal ({selectedYear})</CardTitle>
          <CardDescription className="text-xs">Tarifa aplicada: R$ {tariff.toFixed(2)}/kWh</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={monthlyData.filter(m => m.hasData)} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradEconomy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="economyBrl"
                name="Economia (R$)"
                fill="hsl(var(--success))"
                fillOpacity={0.7}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="savingPct"
                name="Economia (%)"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
                yAxisId={0}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly table — §4 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground text-xs">Mês</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Consumo</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Compensado</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Fatura</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Sem Solar</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">Economia</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">%</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs">Bandeira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.filter(m => m.hasData).map(m => (
                  <TableRow key={m.month} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium text-foreground">{m.label}/{selectedYear}</TableCell>
                    <TableCell className="text-sm text-right font-mono">{m.consumed.toLocaleString("pt-BR")} kWh</TableCell>
                    <TableCell className="text-sm text-right font-mono">{m.compensated.toLocaleString("pt-BR")} kWh</TableCell>
                    <TableCell className="text-sm text-right font-mono">R$ {m.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-right font-mono text-muted-foreground">R$ {m.fullBill.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-right font-mono font-semibold text-success">R$ {m.economyBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-sm text-right font-mono">{m.savingPct}%</TableCell>
                    <TableCell>
                      {m.bandeira ? (
                        <Badge variant="outline" className={`text-xs ${BANDEIRA_COLORS[m.bandeira] || ""}`}>
                          {BANDEIRA_LABELS[m.bandeira] || m.bandeira}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                {monthlyData.some(m => m.hasData) && (
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell className="text-sm text-foreground">Total</TableCell>
                    <TableCell className="text-sm text-right font-mono">{totals.totalConsumed.toLocaleString("pt-BR")} kWh</TableCell>
                    <TableCell className="text-sm text-right font-mono">{totals.totalCompensated.toLocaleString("pt-BR")} kWh</TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      R$ {yearInvoices.reduce((s, i) => s + (i.total_amount || 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-muted-foreground">
                      R$ {monthlyData.filter(m => m.hasData).reduce((s, m) => s + m.fullBill, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono text-success">
                      R$ {totals.totalEconomyBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono">{totals.avgSaving}%</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        * Economia calculada com base na energia compensada × tarifa média (R$ {tariff.toFixed(2)}/kWh).
        "{totals.monthsWithData} meses com dados em {selectedYear}."
      </p>
    </div>
  );
}
