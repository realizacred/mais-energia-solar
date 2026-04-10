/**
 * LeadsByOriginChart — Horizontal bar chart showing leads by origin with conversion rate.
 * §5-S1: Recharts. RB-01: semantic colors. RB-02: dark mode.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadsByOrigin } from "@/hooks/useCommercialMetrics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Crosshair } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Último ano" },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

export function LeadsByOriginChart() {
  const [months, setMonths] = useState(12);
  const { data, isLoading } = useLeadsByOrigin(months);

  const chartData = useMemo(() =>
    data.slice(0, 10).map((d, i) => ({
      ...d,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })),
    [data]
  );

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const totalLeads = data.reduce((s, d) => s + d.total, 0);
  const totalConvertidos = data.reduce((s, d) => s + d.convertidos, 0);
  const taxaGeral = totalLeads > 0 ? Math.round((totalConvertidos / totalLeads) * 1000) / 10 : 0;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Crosshair className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Leads por Origem</CardTitle>
            <CardDescription>
              {totalLeads} leads · {taxaGeral}% conversão geral
            </CardDescription>
          </div>
        </div>
        <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead encontrado no período.</p>
        ) : (
          <div className="space-y-4">
            <ChartContainer
              config={{
                total: { label: "Leads", color: "hsl(var(--primary))" },
                convertidos: { label: "Convertidos", color: "hsl(var(--success))" },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    type="category"
                    dataKey="origem"
                    width={120}
                    tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === "total" ? "Leads" : "Convertidos",
                    ]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={16}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} fillOpacity={0.7} />
                    ))}
                  </Bar>
                  <Bar dataKey="convertidos" radius={[0, 4, 4, 0]} barSize={16} fill="hsl(var(--success))" fillOpacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>

            {/* Legend table */}
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-foreground">Origem</th>
                    <th className="px-3 py-2 text-right font-semibold text-foreground">Leads</th>
                    <th className="px-3 py-2 text-right font-semibold text-foreground">Convertidos</th>
                    <th className="px-3 py-2 text-right font-semibold text-foreground">Conversão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={d.origem} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-1.5 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="truncate">{d.origem}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{d.total}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-success">{d.convertidos}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{d.taxaConversao}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
