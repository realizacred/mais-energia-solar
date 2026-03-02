import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { MonitorReadingDaily } from "@/services/monitoring/monitorTypes";
import { format, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  readings: MonitorReadingDaily[];
}

export function MonitorGenerationChart({ readings }: Props) {
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    readings.forEach((r) => {
      map.set(r.date, (map.get(r.date) || 0) + (r.energy_kwh || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, kwh]) => ({
        date,
        label: format(parseISO(date), "dd/MM", { locale: ptBR }),
        kwh: Number(kwh.toFixed(1)),
        isPartial: isToday(parseISO(date)),
      }));
  }, [readings]);

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Sem leituras no período
      </p>
    );
  }

  const maxKwh = Math.max(...chartData.map((d) => d.kwh), 1);

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="barGradientPartial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            strokeOpacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval={chartData.length > 15 ? Math.floor(chartData.length / 8) : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            unit=" kWh"
            width={70}
            domain={[0, Math.ceil(maxKwh * 1.15)]}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "10px",
              fontSize: "12px",
              boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
            }}
            formatter={(value: number, _name: string, entry: any) => [
              `${value} kWh${entry.payload.isPartial ? " (parcial)" : ""}`,
              "Geração",
            ]}
            labelFormatter={(label) => `Dia ${label}`}
          />
          <Bar dataKey="kwh" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.isPartial ? "url(#barGradientPartial)" : "url(#barGradient)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {chartData.some((d) => d.isPartial) && (
        <p className="text-[10px] text-muted-foreground text-right pr-2">
          * Dia atual com dados parciais
        </p>
      )}
    </div>
  );
}
