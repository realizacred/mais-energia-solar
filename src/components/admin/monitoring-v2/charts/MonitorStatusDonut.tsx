import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MonitorDashboardStats } from "@/services/monitoring/monitorTypes";

interface Props {
  stats: MonitorDashboardStats;
}

const STATUS_CONFIG = [
  { key: "Online", color: "hsl(var(--success))" },
  { key: "Alerta", color: "hsl(var(--warning))" },
  { key: "Offline", color: "hsl(var(--destructive))" },
  { key: "Sem dados", color: "hsl(var(--muted-foreground))" },
];

export function MonitorStatusDonut({ stats }: Props) {
  const data = [
    { name: "Online", value: stats.plants_online },
    { name: "Alerta", value: stats.plants_alert },
    { name: "Offline", value: stats.plants_offline },
    { name: "Sem dados", value: stats.plants_unknown },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          stroke="hsl(var(--card))"
          strokeWidth={2}
        >
          {data.map((entry) => {
            const cfg = STATUS_CONFIG.find((c) => c.key === entry.name);
            return <Cell key={entry.name} fill={cfg?.color || "hsl(var(--muted-foreground))"} />;
          })}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            fontSize: "12px",
            boxShadow: "var(--shadow-md)",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
