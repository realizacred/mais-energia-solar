import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MonitorReadingDaily } from "@/services/monitoring/monitorTypes";

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
        date: date.slice(5),
        kwh: Number(kwh.toFixed(1)),
      }));
  }, [readings]);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem leituras no período</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="genGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit=" kWh" width={70} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            fontSize: "12px",
            boxShadow: "var(--shadow-md)",
          }}
          formatter={(value: number) => [`${value} kWh`, "Geração"]}
        />
        <Area
          type="monotone"
          dataKey="kwh"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#genGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
