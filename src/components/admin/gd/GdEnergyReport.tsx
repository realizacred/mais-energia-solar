/**
 * GdEnergyReport — Historical energy report for a GD Group.
 * Shows monthly table + chart with generation, compensation, surplus, savings.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, DollarSign, Zap, ArrowDownUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart } from "recharts";
import { useGdGroupEnergyHistory, type MonthlyReportRow } from "@/hooks/useGdEnergyReport";
import { useGdCreditBalance } from "@/hooks/useGdEnergyEngine";
import { formatBRL } from "@/lib/formatters";

interface Props {
  groupId: string;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{Number(p.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
        </p>
      ))}
    </div>
  );
};

export function GdEnergyReport({ groupId }: Props) {
  const { data: history = [], isLoading } = useGdGroupEnergyHistory(groupId, 12);
  const { data: balances = [] } = useGdCreditBalance(groupId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 space-y-2 rounded-lg border border-dashed border-border">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhum histórico energético</p>
        <p className="text-xs text-muted-foreground">Calcule meses na aba Energia Mensal para gerar o relatório</p>
      </div>
    );
  }

  // Totals
  const totalGeneration = history.reduce((s, r) => s + r.generation_kwh, 0);
  const totalCompensated = history.reduce((s, r) => s + r.total_compensated_kwh, 0);
  const totalSurplus = history.reduce((s, r) => s + r.total_surplus_kwh, 0);
  const totalSavings = history.reduce((s, r) => s + r.estimated_savings_brl, 0);
  const totalBalance = balances.reduce((s: number, b: any) => s + Number(b.balance_kwh || 0), 0);

  // Chart data
  const chartData = history.map((r) => ({
    mes: `${MONTH_LABELS[r.reference_month - 1]}/${String(r.reference_year).slice(2)}`,
    "Geração": r.generation_kwh,
    "Compensado": r.total_compensated_kwh,
    "Sobra": r.total_surplus_kwh,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Relatório Energético</span>
        <Badge variant="outline" className="text-xs ml-auto">{history.length} meses</Badge>
      </div>

      {/* KPI Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">
                {totalGeneration.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">kWh Gerados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <ArrowDownUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">
                {totalCompensated.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">kWh Compensados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">
                {totalSurplus.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">kWh Sobra</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">
                {formatBRL(totalSavings)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Economia Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">
                {totalBalance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">kWh Saldo Atual</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <Card className="bg-card shadow-sm">
          <CardContent className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mes"
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
                <Bar dataKey="Geração" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Compensado" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Sobra" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Table */}
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Mês</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Geração</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Compensado</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Sobra</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Déficit</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.map((r) => (
              <TableRow key={`${r.reference_year}-${r.reference_month}`} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-foreground text-sm">
                  {MONTH_LABELS[r.reference_month - 1]}/{r.reference_year}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.generation_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-success">
                  {r.total_compensated_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.total_surplus_kwh > 0 ? (
                    <span className="text-warning">{r.total_surplus_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.total_deficit_kwh > 0 ? (
                    <span className="text-destructive">{r.total_deficit_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {r.estimated_savings_brl > 0
                    ? formatBRL(r.estimated_savings_brl)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={r.calculation_status === "complete" ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {r.calculation_status === "complete" ? "OK" : r.calculation_status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
