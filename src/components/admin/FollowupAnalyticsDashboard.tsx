import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/ui-kit";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  BarChart3, TrendingUp, Zap, MessageCircle, CheckCircle2,
  AlertTriangle, Brain, Clock, Target, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--muted-foreground))",
];

export function FollowupAnalyticsDashboard() {
  // Fetch followup logs (last 30 days)
  const { data: logs, isLoading } = useQuery({
    queryKey: ["followup-analytics-logs"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("wa_followup_logs")
        .select("action, ai_confidence, ai_model, created_at, metadata")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Fetch followup queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["followup-analytics-queue"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("wa_followup_queue")
        .select("status, sent_at, responded_at, created_at")
        .gte("created_at", thirtyDaysAgo);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Computed metrics
  const metrics = useMemo(() => {
    if (!logs || !queueStats) return null;

    const totalSent = queueStats.filter((q: any) => q.status === "enviado" || q.status === "respondido").length;
    const totalResponded = queueStats.filter((q: any) => q.status === "respondido").length;
    const totalPending = queueStats.filter((q: any) => q.status === "pendente").length;
    const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

    // AI metrics from logs
    const aiActions = logs.filter((l: any) => l.action === "ai_approved" || l.action === "ai_rejected" || l.action === "ai_generated");
    const aiApproved = logs.filter((l: any) => l.action === "ai_approved").length;
    const aiRejected = logs.filter((l: any) => l.action === "ai_rejected").length;
    const aiGenerated = logs.filter((l: any) => l.action === "ai_generated").length;
    const aiTotal = aiApproved + aiRejected;
    const aiApprovalRate = aiTotal > 0 ? Math.round((aiApproved / aiTotal) * 100) : 0;

    // Confidence distribution
    const confidences = logs
      .filter((l: any) => l.ai_confidence !== null && l.ai_confidence !== undefined)
      .map((l: any) => l.ai_confidence as number);
    const avgConfidence = confidences.length
      ? Math.round(confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length)
      : 0;

    // Response time (from sent to responded)
    const responseTimes = queueStats
      .filter((q: any) => q.status === "respondido" && q.sent_at && q.responded_at)
      .map((q: any) => {
        const sent = new Date(q.sent_at).getTime();
        const resp = new Date(q.responded_at).getTime();
        return Math.round((resp - sent) / (1000 * 60)); // minutes
      })
      .filter((t: number) => t > 0 && t < 10080); // filter outliers (< 7 days)
    const avgResponseTime = responseTimes.length
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : null;

    // Daily breakdown (last 14 days)
    const dailyMap = new Map<string, { sent: number; responded: number; ai: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { sent: 0, responded: 0, ai: 0 });
    }
    queueStats.forEach((q: any) => {
      const key = q.created_at?.slice(0, 10);
      if (dailyMap.has(key)) {
        const entry = dailyMap.get(key)!;
        if (q.status === "enviado" || q.status === "respondido") entry.sent++;
        if (q.status === "respondido") entry.responded++;
      }
    });
    logs.forEach((l: any) => {
      const key = l.created_at?.slice(0, 10);
      if (dailyMap.has(key) && (l.action === "ai_generated" || l.action === "ai_approved")) {
        dailyMap.get(key)!.ai++;
      }
    });
    const dailyChart = Array.from(dailyMap.entries()).map(([date, vals]) => ({
      date: date.slice(5), // MM-DD
      ...vals,
    }));

    // Action breakdown for pie chart
    const actionCounts: Record<string, number> = {};
    logs.forEach((l: any) => {
      actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
    });
    const actionPie = Object.entries(actionCounts)
      .map(([name, value]) => ({ name: formatAction(name), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Model usage
    const modelCounts: Record<string, number> = {};
    logs.forEach((l: any) => {
      if (l.ai_model) modelCounts[l.ai_model] = (modelCounts[l.ai_model] || 0) + 1;
    });

    // Learning dataset size
    const datasetSize = logs.filter(
      (l: any) => l.action === "responded" || l.action === "converted" || l.action === "ai_approved"
    ).length;

    return {
      totalSent,
      totalResponded,
      totalPending,
      responseRate,
      aiGenerated,
      aiApproved,
      aiRejected,
      aiApprovalRate,
      avgConfidence,
      avgResponseTime,
      dailyChart,
      actionPie,
      modelCounts,
      datasetSize,
      totalLogs: logs.length,
    };
  }, [logs, queueStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Sem dados de follow-up no período (30 dias)
        </CardContent>
      </Card>
    );
  }

  const formatMinutes = (mins: number | null) => {
    if (mins === null) return "—";
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Follow-ups Enviados"
          value={metrics.totalSent}
          icon={Zap}
          color="primary"
        />
        <StatCard
          label="Taxa de Resposta"
          value={`${metrics.responseRate}%`}
          icon={TrendingUp}
          color={metrics.responseRate > 50 ? "success" : metrics.responseRate > 25 ? "warning" : "destructive"}
        />
        <StatCard
          label="Tempo Médio Resposta"
          value={formatMinutes(metrics.avgResponseTime)}
          icon={Clock}
          color="info"
        />
        <StatCard
          label="Pendentes"
          value={metrics.totalPending}
          icon={AlertTriangle}
          color={metrics.totalPending > 50 ? "warning" : "muted"}
        />
      </div>

      {/* AI Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Msgs Geradas por IA"
          value={metrics.aiGenerated}
          icon={Brain}
          color="primary"
        />
        <StatCard
          label="Taxa Aprovação IA"
          value={`${metrics.aiApprovalRate}%`}
          icon={CheckCircle2}
          color={metrics.aiApprovalRate > 70 ? "success" : "warning"}
        />
        <StatCard
          label="Confiança Média IA"
          value={`${metrics.avgConfidence}%`}
          icon={Target}
          color={metrics.avgConfidence > 70 ? "success" : "warning"}
        />
        <StatCard
          label="Dataset de Aprendizado"
          value={metrics.datasetSize}
          icon={Sparkles}
          color="info"
          subtitle="interações para treinamento"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Envios e Respostas (14 dias)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metrics.dailyChart} barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={30} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="sent" name="Enviados" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="responded" name="Respondidos" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ai" name="IA" fill="hsl(var(--info))" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Action breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ações Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.actionPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={metrics.actionPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {metrics.actionPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Model usage & Learning dataset */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model usage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Uso por Modelo de IA</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(metrics.modelCounts).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(metrics.modelCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, count]) => {
                    const maxCount = Math.max(...Object.values(metrics.modelCounts));
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={model} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{model}</span>
                          <span className="text-muted-foreground">{count} chamadas</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum modelo utilizado</p>
            )}
          </CardContent>
        </Card>

        {/* Dataset quality */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Dataset de Aprendizado</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Interações que alimentam a melhoria contínua da IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-border/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">Respostas obtidas</span>
                </div>
                <Badge variant="outline" className="font-bold">{metrics.totalResponded}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-border/20">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm">IA aprovada pelo consultor</span>
                </div>
                <Badge variant="outline" className="font-bold">{metrics.aiApproved}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-border/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">IA rejeitada</span>
                </div>
                <Badge variant="outline" className="font-bold">{metrics.aiRejected}</Badge>
              </div>
              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total no dataset</span>
                  <span className="text-sm font-bold text-foreground">{metrics.datasetSize} registros</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cada interação aprovada ou respondida é armazenada para refinar as sugestões futuras da IA.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    sent: "Enviado",
    responded: "Respondido",
    ai_generated: "IA Gerou",
    ai_approved: "IA Aprovada",
    ai_rejected: "IA Rejeitada",
    converted: "Convertido",
    manual_sent: "Manual",
    timeout: "Timeout",
  };
  return map[action] || action;
}
