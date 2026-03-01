import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonitorReadingDaily } from "@/services/monitoring/monitorTypes";

interface Props {
  readings: MonitorReadingDaily[];
  plants: Array<{ id: string; name: string; installed_power_kwp: number | null }>;
}

const AVG_SUN_HOURS = 4.5;

export function MonitorGenerationVsEstimateChart({ readings, plants }: Props) {
  const chartData = useMemo(() => {
    // Group readings by date
    const byDate = new Map<string, number>();
    readings.forEach((r) => {
      byDate.set(r.date, (byDate.get(r.date) || 0) + r.energy_kwh);
    });

    // Total installed capacity
    const totalKwp = plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0);
    const dailyEstimate = totalKwp * AVG_SUN_HOURS;

    // Sort dates and build chart data
    const sortedDates = Array.from(byDate.keys()).sort();
    return sortedDates.map((date) => ({
      date,
      label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      realizado: Math.round(byDate.get(date)! * 10) / 10,
      projetado: Math.round(dailyEstimate * 10) / 10,
    }));
  }, [readings, plants]);

  if (chartData.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados para comparação.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          unit=" kWh"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number, name: string) => [
            `${value.toFixed(1)} kWh`,
            name === "realizado" ? "Realizado" : "Projetado",
          ]}
          labelFormatter={(label) => `📅 ${label}`}
        />
        <Legend
          formatter={(value) => (value === "realizado" ? "Realizado" : "Projetado")}
          wrapperStyle={{ fontSize: "12px" }}
        />
        <Bar dataKey="projetado" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
        <Bar dataKey="realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
