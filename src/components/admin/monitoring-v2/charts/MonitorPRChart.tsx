import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { PlantPerformanceRatio } from "@/services/monitoring/monitorFinancialService";

interface Props {
  data: PlantPerformanceRatio[];
}

export function MonitorPRChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de performance</p>;
  }

  const chartData = data
    .filter((d) => d.pr_status === "ok")
    .slice(0, 15)
    .map((d) => ({
      name: d.plant_name.length > 18 ? d.plant_name.slice(0, 16) + "…" : d.plant_name,
      pr: d.pr_percent,
      fullName: d.plant_name,
      hspSource: d.hsp_source,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
        <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="%" />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={120} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [`${value}%`, "PR"]}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
        />
        <ReferenceLine x={75} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "75%", fill: "hsl(var(--warning))", fontSize: 10 }} />
        <Bar dataKey="pr" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={
                entry.pr >= 80 ? "hsl(var(--success))"
                : entry.pr >= 60 ? "hsl(var(--warning))"
                : "hsl(var(--destructive))"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
