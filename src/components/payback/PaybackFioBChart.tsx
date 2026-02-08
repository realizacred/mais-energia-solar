import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Line,
  ComposedChart,
  Legend,
} from "recharts";

interface FioBChartData {
  ano: number;
  percentual: number;
  custoFioB: number;
  economiaLiquida: number;
}

interface PaybackFioBChartProps {
  data: FioBChartData[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            {p.name === "Fio B (%)" ? `${p.value}%` : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function PaybackFioBChart({ data }: PaybackFioBChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-warning" />
            Impacto do Fio B ao Longo dos Anos
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Lei 14.300
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="ano"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v) => `R$${(v / 1).toFixed(0)}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Bar
                yAxisId="left"
                dataKey="custoFioB"
                name="Custo Fio B"
                fill="hsl(var(--warning))"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Bar
                yAxisId="left"
                dataKey="economiaLiquida"
                name="Economia Líquida"
                fill="hsl(var(--success))"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Line
                yAxisId="right"
                dataKey="percentual"
                name="Fio B (%)"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3 }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          O Fio B (TUSD) é cobrado progressivamente conforme Lei 14.300. A partir de 2028, 90% da
          TUSD passa a ser cobrada dos prosumidores GD II.
        </p>
      </CardContent>
    </Card>
  );
}
