import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Target, Flame, ThermometerSun, Snowflake } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { RevenueForecast as RevenueForecastType } from "@/hooks/useLeadScoring";

interface RevenueForecastProps {
  forecast: RevenueForecastType | null;
  ticketMedio: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);

export function RevenueForecast({ forecast, ticketMedio }: RevenueForecastProps) {
  const chartData = useMemo(() => {
    if (!forecast) return [];
    return [
      {
        name: "Quentes",
        leads: forecast.por_nivel.hot.count,
        valor: forecast.por_nivel.hot.valor,
        ponderado: forecast.por_nivel.hot.valor * forecast.por_nivel.hot.probabilidade,
        fill: "hsl(var(--destructive))",
      },
      {
        name: "Mornos",
        leads: forecast.por_nivel.warm.count,
        valor: forecast.por_nivel.warm.valor,
        ponderado: forecast.por_nivel.warm.valor * forecast.por_nivel.warm.probabilidade,
        fill: "hsl(var(--warning))",
      },
      {
        name: "Frios",
        leads: forecast.por_nivel.cold.count,
        valor: forecast.por_nivel.cold.valor,
        ponderado: forecast.por_nivel.cold.valor * forecast.por_nivel.cold.probabilidade,
        fill: "hsl(var(--info))",
      },
    ];
  }, [forecast]);

  if (!forecast) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Execute o scoring para ver a previsão de faturamento.
        </CardContent>
      </Card>
    );
  }

  const totalLeads = forecast.por_nivel.hot.count + forecast.por_nivel.warm.count + forecast.por_nivel.cold.count;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Previsão Ponderada</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(forecast.ponderado)}</p>
            <p className="text-[10px] text-muted-foreground">Considerando probabilidades</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground font-medium">Leads Quentes</span>
            </div>
            <p className="text-xl font-bold">{forecast.por_nivel.hot.count}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatCurrency(forecast.por_nivel.hot.valor)} potencial
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <ThermometerSun className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground font-medium">Leads Mornos</span>
            </div>
            <p className="text-xl font-bold">{forecast.por_nivel.warm.count}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatCurrency(forecast.por_nivel.warm.valor)} potencial
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-secondary" />
              <span className="text-xs text-muted-foreground font-medium">Ticket Médio</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(ticketMedio)}</p>
            <p className="text-[10px] text-muted-foreground">{totalLeads} leads na base</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Potencial de Faturamento por Temperatura
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "ponderado" ? "Ponderado" : "Potencial",
                  ]}
                />
                <Bar dataKey="valor" name="Potencial" radius={[4, 4, 0, 0]} opacity={0.3}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
                <Bar dataKey="ponderado" name="Ponderado" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
