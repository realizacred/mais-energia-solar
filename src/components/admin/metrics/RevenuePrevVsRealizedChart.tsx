/**
 * RevenuePrevVsRealizedChart — Grouped bar chart comparing forecasted vs realized revenue.
 * §5-S1: Recharts. RB-01: semantic colors. §48: formatBRLCompact for axis.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRevenuePrevVsRealized } from "@/hooks/useCommercialMetrics";
import { formatBRLInteger, formatBRLCompact } from "@/lib/formatters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
];

export function RevenuePrevVsRealizedChart() {
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useRevenuePrevVsRealized(months);

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const { monthly, totalPrevisto, totalRealizado } = data;
  const atingimento = totalPrevisto > 0 ? Math.round((totalRealizado / totalPrevisto) * 100) : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-success" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Receita Prevista vs Realizada</CardTitle>
            <CardDescription>Comparação mensal de pipeline criado vs receita ganha</CardDescription>
          </div>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center">
            <p className="text-lg font-bold tracking-tight text-foreground">{formatBRLCompact(totalPrevisto)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pipeline criado</p>
          </div>
          <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-center">
            <p className="text-lg font-bold tracking-tight text-success">{formatBRLCompact(totalRealizado)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Receita realizada</p>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-center flex flex-col items-center justify-center">
            <div className="flex items-center gap-1">
              {atingimento >= 100 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-warning" />
              )}
              <p className={`text-lg font-bold tracking-tight ${atingimento >= 100 ? "text-success" : "text-warning"}`}>
                {atingimento}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Atingimento</p>
          </div>
        </div>

        {/* Chart */}
        {monthly.length > 0 ? (
          <ChartContainer
            config={{
              previsto: { label: "Pipeline criado", color: "hsl(var(--muted-foreground))" },
              realizado: { label: "Receita realizada", color: "hsl(var(--success))" },
            }}
            className="h-[280px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="mesLabel"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatBRLInteger(value), undefined]}
                  labelFormatter={(label: string) => label}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  formatter={(value: string) => value === "previsto" ? "Pipeline criado" : "Receita realizada"}
                />
                <Bar dataKey="previsto" fill="hsl(var(--muted-foreground))" fillOpacity={0.3} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="realizado" fill="hsl(var(--success))" fillOpacity={0.85} radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum deal encontrado no período.</p>
        )}
      </CardContent>
    </Card>
  );
}
