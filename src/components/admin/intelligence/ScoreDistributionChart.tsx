import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";
import type { LeadScore } from "@/hooks/useLeadScoring";

interface ScoreDistributionChartProps {
  scores: LeadScore[];
}

export function ScoreDistributionChart({ scores }: ScoreDistributionChartProps) {
  const pieData = useMemo(() => {
    const counts = { hot: 0, warm: 0, cold: 0 };
    scores.forEach(s => counts[s.nivel]++);
    return [
      { name: "Quentes", value: counts.hot, fill: "hsl(var(--destructive))" },
      { name: "Mornos", value: counts.warm, fill: "hsl(var(--warning))" },
      { name: "Frios", value: counts.cold, fill: "hsl(var(--info))" },
    ].filter(d => d.value > 0);
  }, [scores]);

  const histogramData = useMemo(() => {
    const ranges = [
      { name: "0-20", min: 0, max: 20, count: 0 },
      { name: "21-40", min: 21, max: 40, count: 0 },
      { name: "41-60", min: 41, max: 60, count: 0 },
      { name: "61-80", min: 61, max: 80, count: 0 },
      { name: "81-100", min: 81, max: 100, count: 0 },
    ];
    scores.forEach(s => {
      const range = ranges.find(r => s.score >= r.min && s.score <= r.max);
      if (range) range.count++;
    });
    return ranges;
  }, [scores]);

  if (scores.length === 0) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Distribuição por nível */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Distribuição por Temperatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Histograma de scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-secondary" />
            Histograma de Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData}>
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [value, "Leads"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
