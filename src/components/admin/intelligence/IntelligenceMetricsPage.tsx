import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligenceMetrics } from "@/hooks/useIntelligenceMetrics";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FeatureGate } from "@/components/plan/FeatureGate";

const TEMP_COLORS: Record<string, string> = {
  quente: "hsl(var(--destructive))",
  morno: "hsl(var(--warning))",
  frio: "hsl(var(--info))",
  congelado: "hsl(var(--muted-foreground))",
  sem_analise: "hsl(var(--border))",
};

const TEMP_LABELS: Record<string, string> = {
  quente: "🔥 Quente",
  morno: "🟡 Morno",
  frio: "❄️ Frio",
  congelado: "🧊 Congelado",
  sem_analise: "⬜ Sem análise",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export function IntelligenceMetricsPage() {
  const { data: metrics, isLoading } = useIntelligenceMetrics();

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!metrics) return null;

  const kpis = [
    { label: "Leads Analisados", value: metrics.totalAnalisados, icon: BarChart3, color: "border-l-primary" },
    { label: "Alertas Ativos", value: metrics.alertasAtivos, icon: AlertTriangle, color: "border-l-warning" },
    { label: "Taxa Conversão", value: `${metrics.taxaConversao}%`, icon: TrendingUp, color: "border-l-success" },
    { label: "Tempo Médio (h)", value: `${metrics.tempoMedioResolucao}h`, icon: Clock, color: "border-l-info" },
  ];

  const pieData = metrics.distribuicaoTemperamento.map((d) => ({
    name: TEMP_LABELS[d.temperamento] || d.temperamento,
    value: d.count,
    fill: TEMP_COLORS[d.temperamento] || "hsl(var(--muted))",
  }));

  const barData = metrics.conversaoPorAbordagem.map((d) => ({
    acao: d.acao,
    sucesso: d.sucesso,
    total: d.total,
    taxa: d.total > 0 ? Math.round((d.sucesso / d.total) * 100) : 0,
  }));

  return (
    <FeatureGate featureKey="alerta_performance">
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Métricas de Inteligência</h1>
          <p className="text-sm text-muted-foreground">Performance da análise e alertas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className={`border-l-[3px] ${kpi.color} bg-card shadow-sm`}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpi.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição */}
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-foreground mb-4">Distribuição de Temperamento</p>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Conversão por abordagem */}
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <p className="text-sm font-semibold text-foreground mb-4">Conversão por Abordagem</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="acao" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sucesso" name="Sucesso" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
