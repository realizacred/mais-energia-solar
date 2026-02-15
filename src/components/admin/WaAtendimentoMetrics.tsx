import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui-kit/Spinner";
import { StatCard } from "@/components/ui-kit";
import {
  Clock, MessageCircle, Users, TrendingUp, Zap, AlertTriangle,
  CheckCircle2, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConsultorMetric {
  user_id: string;
  nome: string;
  total_conversas: number;
  total_msgs_out: number;
  total_msgs_in: number;
  avg_response_minutes: number | null;
  conversas_respondidas: number;
  taxa_resposta: number;
}

export function WaAtendimentoMetrics() {
  // Fetch all consultores
  const { data: consultores = [] } = useQuery({
    queryKey: ["wa-metrics-consultores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome, user_id")
        .eq("ativo", true);
      return (data || []).filter((c: any) => c.user_id);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch conversations with assignment stats (last 30 days)
  const { data: convStats, isLoading } = useQuery({
    queryKey: ["wa-metrics-conversations"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      // Get conversations updated in last 30 days
      const { data: convs } = await supabase
        .from("wa_conversations")
        .select("id, assigned_to, status, last_message_at, created_at")
        .eq("is_group", false)
        .gte("last_message_at", thirtyDaysAgo);

      // Get followup queue stats
      const { data: followups } = await supabase
        .from("wa_followup_queue")
        .select("status, assigned_to, sent_at, responded_at, created_at")
        .gte("created_at", thirtyDaysAgo);

      // Get SLA alerts  
      const { data: slaAlerts } = await (supabase as any)
        .from("wa_sla_alerts")
        .select("id, assigned_to, resolved, escalated, tempo_sem_resposta_minutos, created_at")
        .gte("created_at", thirtyDaysAgo);

      return {
        conversations: convs || [],
        followups: followups || [],
        slaAlerts: slaAlerts || [],
      };
    },
    staleTime: 60 * 1000,
  });

  // Calculate per-consultant metrics
  const metrics = useMemo((): ConsultorMetric[] => {
    if (!convStats || !consultores.length) return [];

    return consultores.map((c: any) => {
      const myConvs = convStats.conversations.filter((cv: any) => cv.assigned_to === c.user_id);
      const myFollowups = convStats.followups.filter((f: any) => f.assigned_to === c.user_id);
      const respondidos = myFollowups.filter((f: any) => f.status === "respondido").length;
      const enviados = myFollowups.filter((f: any) => f.status === "enviado" || f.status === "respondido").length;

      // Estimate avg response time from SLA alerts
      const myAlerts = convStats.slaAlerts.filter((a: any) => a.assigned_to === c.user_id);
      const responseTimes = myAlerts
        .filter((a: any) => a.tempo_sem_resposta_minutos)
        .map((a: any) => a.tempo_sem_resposta_minutos as number);
      const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
        : null;

      return {
        user_id: c.user_id,
        nome: c.nome,
        total_conversas: myConvs.length,
        total_msgs_out: enviados,
        total_msgs_in: 0,
        avg_response_minutes: avgResponse,
        conversas_respondidas: respondidos,
        taxa_resposta: enviados > 0 ? Math.round((respondidos / enviados) * 100) : 0,
      };
    }).sort((a, b) => b.total_conversas - a.total_conversas);
  }, [consultores, convStats]);

  // Global stats
  const globalStats = useMemo(() => {
    if (!convStats) return null;
    const totalConvs = convStats.conversations.length;
    const openConvs = convStats.conversations.filter((c: any) => c.status === "open").length;
    const totalFollowups = convStats.followups.length;
    const respondidos = convStats.followups.filter((f: any) => f.status === "respondido").length;
    const pendentes = convStats.followups.filter((f: any) => f.status === "pendente").length;
    const slaViolations = convStats.slaAlerts.filter((a: any) => !a.resolved).length;
    const escalated = convStats.slaAlerts.filter((a: any) => a.escalated && !a.resolved).length;

    const responseTimes = convStats.slaAlerts
      .filter((a: any) => a.tempo_sem_resposta_minutos)
      .map((a: any) => a.tempo_sem_resposta_minutos as number);
    const avgResponseGlobal = responseTimes.length
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : null;

    return {
      totalConvs,
      openConvs,
      totalFollowups,
      respondidos,
      pendentes,
      slaViolations,
      escalated,
      avgResponseMinutes: avgResponseGlobal,
      taxaResposta: totalFollowups > 0 ? Math.round((respondidos / totalFollowups) * 100) : 0,
    };
  }, [convStats]);

  const formatMinutes = (mins: number | null) => {
    if (mins === null) return "—";
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Conversas Ativas"
          value={globalStats?.openConvs || 0}
          icon={MessageCircle}
          color="primary"
        />
        <StatCard
          label="Tempo Médio Resposta"
          value={formatMinutes(globalStats?.avgResponseMinutes ?? null)}
          icon={Clock}
          color={globalStats?.avgResponseMinutes && globalStats.avgResponseMinutes > 120 ? "destructive" : "success"}
        />
        <StatCard
          label="Taxa de Resposta"
          value={`${globalStats?.taxaResposta || 0}%`}
          icon={TrendingUp}
          color={globalStats?.taxaResposta && globalStats.taxaResposta > 70 ? "success" : "warning"}
        />
        <StatCard
          label="Alertas SLA Abertos"
          value={globalStats?.slaViolations || 0}
          icon={AlertTriangle}
          color={globalStats?.slaViolations ? "destructive" : "success"}
        />
      </div>

      {/* Follow-up Performance */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{globalStats?.pendentes || 0}</p>
              <p className="text-xs text-muted-foreground">Follow-ups Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{globalStats?.respondidos || 0}</p>
              <p className="text-xs text-muted-foreground">Follow-ups Respondidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{globalStats?.escalated || 0}</p>
              <p className="text-xs text-muted-foreground">SLA Escalados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Consultor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Performance por Consultor (30 dias)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Consultor</th>
                    <th className="text-center p-3 font-medium">Conversas</th>
                    <th className="text-center p-3 font-medium">Tempo Médio</th>
                    <th className="text-center p-3 font-medium">Follow-ups</th>
                    <th className="text-center p-3 font-medium">Taxa Resposta</th>
                    <th className="text-center p-3 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        Sem dados de atendimento no período
                      </td>
                    </tr>
                  ) : (
                    metrics.map((m) => {
                      // Score: lower response time + higher response rate = better
                      const responseScore = m.avg_response_minutes
                        ? Math.max(0, 100 - Math.min(100, m.avg_response_minutes / 2))
                        : 50;
                      const overallScore = Math.round((responseScore + m.taxa_resposta) / 2);
                      const scoreColor =
                        overallScore >= 80 ? "text-success" :
                        overallScore >= 50 ? "text-warning" : "text-destructive";

                      return (
                        <tr key={m.user_id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <span className="font-medium">{m.nome}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{m.total_conversas}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <span className={m.avg_response_minutes && m.avg_response_minutes > 120 ? "text-destructive font-semibold" : "text-foreground"}>
                              {formatMinutes(m.avg_response_minutes)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Zap className="h-3 w-3 text-info" />
                              <span>{m.total_msgs_out}</span>
                              {m.conversas_respondidas > 0 && (
                                <Badge className="bg-success/10 text-success text-[9px] px-1">
                                  {m.conversas_respondidas} resp
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-medium">{m.taxa_resposta}%</span>
                              <Progress value={m.taxa_resposta} className="h-1.5 w-16" />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-sm font-bold ${scoreColor}`}>
                              {overallScore}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}