import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MonitorReadingDaily } from "@/services/monitoring/monitorTypes";

interface Props {
  readings: MonitorReadingDaily[];
}

export function MonitorGenerationChart({ readings }: Props) {
  const chartData = useMemo(() => {
    // Aggregate by date
    const map = new Map<string, number>();
    readings.forEach((r) => {
      map.set(r.date, (map.get(r.date) || 0) + (r.energy_kwh || 0));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, kwh]) => ({
        date: date.slice(5), // MM-DD
        kwh: Number(kwh.toFixed(1)),
      }));
  }, [readings]);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem leituras no período</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit=" kWh" width={70} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`${value} kWh`, "Geração"]}
        />
        <Bar dataKey="kwh" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
