import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatBRL, formatInteger } from "@/lib/formatters/index";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DailyRow } from "@/hooks/useMetaAdsData";

type MetricKey = "spend" | "impressions" | "reach" | "clicks" | "leads_count";

const TABS: { key: MetricKey; label: string }[] = [
  { key: "spend", label: "Investimento" },
  { key: "reach", label: "Alcance" },
  { key: "clicks", label: "Cliques" },
  { key: "leads_count", label: "Leads" },
  { key: "impressions", label: "Impressões" },
];

function fmtValue(key: MetricKey, v: number): string {
  return key === "spend" ? formatBRL(v) : formatInteger(v);
}

interface Props {
  daily: DailyRow[];
  isLoading?: boolean;
}

export function MetaTimeSeriesChart({ daily, isLoading }: Props) {
  const [metric, setMetric] = useState<MetricKey>("spend");

  const chartData = daily.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Evolução no Período
          </CardTitle>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <Button
                key={tab.key}
                variant={metric === tab.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setMetric(tab.key)}
                className="h-7 px-2.5 text-xs"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] bg-muted animate-pulse rounded-lg" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum dado disponível
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="metaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtValue(metric, v)}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => [
                  fmtValue(metric, value),
                  TABS.find((t) => t.key === metric)?.label,
                ]}
                labelFormatter={(label) => `Data: ${label}`}
                contentStyle={{
                  borderRadius: "var(--radius)",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#metaAreaGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
