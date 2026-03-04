import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieIcon } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatBRL } from "@/lib/formatters/index";
import type { CampaignRow } from "@/hooks/useMetaAdsData";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.35)",
  "hsl(180 60% 50%)",
  "hsl(200 60% 55%)",
];

interface Props {
  campaigns: CampaignRow[];
  isLoading?: boolean;
}

export function SpendDistributionChart({ campaigns, isLoading }: Props) {
  const top = campaigns.slice(0, 5);
  const othersSpend = campaigns.slice(5).reduce((s, c) => s + c.spend, 0);

  const data = [
    ...top.map((c) => ({
      name: c.campaign_name?.length > 20 ? c.campaign_name.slice(0, 18) + "…" : c.campaign_name || "Sem nome",
      value: c.spend,
      fullName: c.campaign_name,
    })),
    ...(othersSpend > 0 ? [{ name: "Outras", value: othersSpend, fullName: "Outras campanhas" }] : []),
  ];

  const totalSpend = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PieIcon className="h-4 w-4 text-primary" />
          Distribuição de Gastos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[260px] bg-muted animate-pulse rounded-lg" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
        ) : (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatBRL(value), "Gasto"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  contentStyle={{
                    borderRadius: "var(--radius)",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-1 mt-2">
              {data.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-muted-foreground truncate max-w-[140px]">{d.name}</span>
                  </div>
                  <span className="font-medium">{formatBRL(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
