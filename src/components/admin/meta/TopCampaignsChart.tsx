import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatBRL, formatInteger } from "@/lib/formatters/index";

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads_count: number;
}

interface Props {
  campaigns: CampaignRow[];
  isLoading?: boolean;
}

type MetricKey = "spend" | "impressions" | "clicks" | "leads_count";

const TABS: { key: MetricKey; label: string }[] = [
  { key: "spend", label: "Investimento" },
  { key: "impressions", label: "Impressões" },
  { key: "clicks", label: "Cliques" },
  { key: "leads_count", label: "Leads" },
];

const BAR_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--primary) / 0.25)",
  "hsl(var(--primary) / 0.18)",
];

function formatValue(key: MetricKey, value: number): string {
  if (key === "spend") return formatBRL(value);
  return formatInteger(value);
}

export function TopCampaignsChart({ campaigns, isLoading }: Props) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("spend");

  const top6 = campaigns
    .sort((a, b) => b[activeMetric] - a[activeMetric])
    .slice(0, 6);

  const chartData = top6.map((c) => ({
    name: c.campaign_name?.length > 25
      ? c.campaign_name.slice(0, 22) + "..."
      : c.campaign_name || "Sem nome",
    value: c[activeMetric],
    fullName: c.campaign_name,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Top Campanhas
          </CardTitle>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveMetric(tab.key)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  activeMetric === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[280px] bg-muted animate-pulse rounded-lg" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhuma campanha encontrada
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tickFormatter={(v) => formatValue(activeMetric, v)} fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatValue(activeMetric, value), TABS.find((t) => t.key === activeMetric)?.label]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
