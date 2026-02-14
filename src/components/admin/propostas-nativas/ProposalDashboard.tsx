import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, TrendingUp, CheckCircle2, XCircle, Send, Clock,
  DollarSign, Timer, BarChart3, PieChart,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);

interface DashMetrics {
  total: number;
  por_status: Record<string, number>;
  valor_total: number;
  valor_aceitas: number;
  taxa_aceite: number;
  ticket_medio: number;
  payback_medio: number;
  por_mes: Array<{ mes: string; total: number; aceitas: number; valor: number }>;
}

export function ProposalDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: propostas } = await supabase
        .from("propostas_nativas")
        .select("id, status, created_at, proposta_versoes(valor_total, payback_meses, economia_mensal)")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!propostas) { setLoading(false); return; }

      const statusMap: Record<string, string> = {
        draft: "rascunho", generated: "gerada", sent: "enviada",
        accepted: "aceita", rejected: "recusada", expired: "expirada",
      };

      const por_status: Record<string, number> = {};
      let valor_total = 0;
      let valor_aceitas = 0;
      let count_aceitas = 0;
      let payback_sum = 0;
      let payback_count = 0;
      const mesMap = new Map<string, { total: number; aceitas: number; valor: number }>();

      for (const p of propostas) {
        const status = statusMap[p.status] || p.status || "rascunho";
        por_status[status] = (por_status[status] || 0) + 1;

        const versions = p.proposta_versoes as any[];
        const latest = versions?.sort((a: any, b: any) => (b.valor_total || 0) - (a.valor_total || 0))?.[0];
        const val = latest?.valor_total || 0;
        valor_total += val;

        if (status === "aceita") { valor_aceitas += val; count_aceitas++; }
        if (latest?.payback_meses) { payback_sum += latest.payback_meses; payback_count++; }

        const mesKey = new Date(p.created_at).toISOString().slice(0, 7);
        const entry = mesMap.get(mesKey) || { total: 0, aceitas: 0, valor: 0 };
        entry.total++;
        if (status === "aceita") entry.aceitas++;
        entry.valor += val;
        mesMap.set(mesKey, entry);
      }

      const total = propostas.length;
      const totalEnviadas = (por_status.enviada || 0) + count_aceitas + (por_status.recusada || 0);

      setMetrics({
        total,
        por_status,
        valor_total,
        valor_aceitas,
        taxa_aceite: totalEnviadas > 0 ? Math.round((count_aceitas / totalEnviadas) * 100) : 0,
        ticket_medio: total > 0 ? Math.round(valor_total / total) : 0,
        payback_medio: payback_count > 0 ? Math.round(payback_sum / payback_count) : 0,
        por_mes: Array.from(mesMap.entries())
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, 6)
          .map(([mes, data]) => ({ mes, ...data })),
      });
    } catch (e) {
      console.error("Erro ao carregar métricas:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!metrics) return null;

  const statusCards = [
    { key: "rascunho", label: "Rascunhos", icon: Clock, color: "border-l-muted-foreground" },
    { key: "gerada", label: "Geradas", icon: FileText, color: "border-l-primary" },
    { key: "enviada", label: "Enviadas", icon: Send, color: "border-l-info" },
    { key: "aceita", label: "Aceitas", icon: CheckCircle2, color: "border-l-success" },
    { key: "recusada", label: "Recusadas", icon: XCircle, color: "border-l-destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-primary">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Propostas</p>
            <p className="text-2xl font-bold">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Taxa de Aceite</p>
            <p className="text-2xl font-bold">{metrics.taxa_aceite}%</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
            <p className="text-2xl font-bold">{formatBRL(metrics.ticket_medio)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning">
          <CardContent className="py-3 px-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Payback Médio</p>
            <p className="text-2xl font-bold">{metrics.payback_medio}m</p>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card className="border-border/60">
        <CardContent className="py-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-muted-foreground" /> Por Status
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {statusCards.map(sc => {
              const Icon = sc.icon;
              const count = metrics.por_status[sc.key] || 0;
              return (
                <div key={sc.key} className={`rounded-lg border ${sc.color} border-l-[3px] p-3`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase">{sc.label}</span>
                  </div>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Volume por mês */}
      <Card className="border-border/60">
        <CardContent className="py-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Volume Mensal
          </p>
          {metrics.por_mes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
          ) : (
            <div className="space-y-2">
              {metrics.por_mes.map(m => {
                const maxVal = Math.max(...metrics.por_mes.map(x => x.total), 1);
                const pct = (m.total / maxVal) * 100;
                return (
                  <div key={m.mes} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{m.mes}</span>
                    <div className="flex-1 bg-muted/50 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/20 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative z-10 flex items-center justify-between px-3 h-full">
                        <span className="text-xs font-medium">{m.total} props</span>
                        <span className="text-xs text-success font-medium">{m.aceitas} aceitas</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold w-24 text-right shrink-0">{formatBRL(m.valor)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Value summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border/60">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Valor Total Gerado</p>
              <p className="text-lg font-bold">{formatBRL(metrics.valor_total)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Valor Aceito</p>
              <p className="text-lg font-bold">{formatBRL(metrics.valor_aceitas)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => navigate("/admin/propostas-nativas")}>
          Ver todas as propostas
        </Button>
      </div>
    </div>
  );
}
