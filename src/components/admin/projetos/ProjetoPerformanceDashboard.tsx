import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, TrendingUp, Target, DollarSign, Zap, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ConsultorPerf {
  id: string;
  nome: string;
  total_deals: number;
  deals_ganhos: number;
  valor_total: number;
  kwp_total: number;
  ticket_medio: number;
  taxa_conversao: number;
}

interface MonthSale {
  month: string; // "2026-01"
  count: number;
  value: number;
}

const formatBRL = (v: number) => {
  if (!v) return "R$ 0";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const RANK_BADGES = ["🥇", "🥈", "🥉"];

export function ProjetoPerformanceDashboard() {
  const [consultores, setConsultores] = useState<ConsultorPerf[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch deals with owner info for performance calc
      const { data: deals } = await supabase
        .from("deal_kanban_projection")
        .select("deal_id, owner_id, owner_name, deal_value, deal_kwp, deal_status, last_stage_change, stage_probability")
        .limit(1000);

      if (deals) {
        // Build consultor performance
        const perfMap = new Map<string, ConsultorPerf>();
        deals.forEach((d: any) => {
          if (!d.owner_id) return;
          if (!perfMap.has(d.owner_id)) {
            perfMap.set(d.owner_id, {
              id: d.owner_id,
              nome: d.owner_name || "—",
              total_deals: 0,
              deals_ganhos: 0,
              valor_total: 0,
              kwp_total: 0,
              ticket_medio: 0,
              taxa_conversao: 0,
            });
          }
          const p = perfMap.get(d.owner_id)!;
          p.total_deals++;
          p.valor_total += d.deal_value || 0;
          p.kwp_total += d.deal_kwp || 0;
          if (d.deal_status === "ganho" || d.stage_probability === 100) {
            p.deals_ganhos++;
          }
        });

        const perfs = Array.from(perfMap.values()).map(p => ({
          ...p,
          ticket_medio: p.deals_ganhos > 0 ? p.valor_total / p.deals_ganhos : 0,
          taxa_conversao: p.total_deals > 0 ? (p.deals_ganhos / p.total_deals) * 100 : 0,
        })).sort((a, b) => b.valor_total - a.valor_total);
        setConsultores(perfs);

        // Build monthly sales from won deals
        const monthMap = new Map<string, MonthSale>();
        deals.filter((d: any) => d.deal_status === "ganho" || d.stage_probability === 100).forEach((d: any) => {
          const month = d.last_stage_change?.substring(0, 7) || "unknown";
          if (!monthMap.has(month)) monthMap.set(month, { month, count: 0, value: 0 });
          const m = monthMap.get(month)!;
          m.count++;
          m.value += d.deal_value || 0;
        });
        setMonthlySales(
          Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12)
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const totalFaturamento = useMemo(() => consultores.reduce((s, c) => s + c.valor_total, 0), [consultores]);
  const totalKwp = useMemo(() => consultores.reduce((s, c) => s + c.kwp_total, 0), [consultores]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento Total</p>
              <p className="text-lg font-bold font-mono text-foreground">{formatBRL(totalFaturamento)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">kWp Total Instalado</p>
              <p className="text-lg font-bold font-mono text-foreground">{totalKwp.toFixed(1).replace(".", ",")} kWp</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consultores Ativos</p>
              <p className="text-lg font-bold text-foreground">{consultores.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Ranking de Consultores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Consultor</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Faturamento</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Conversão</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">kWp</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Projetos</th>
                </tr>
              </thead>
              <tbody>
                {consultores.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm">
                      {i < 3 ? <span className="text-base">{RANK_BADGES[i]}</span> : <span className="text-muted-foreground">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.nome}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">{formatBRL(c.valor_total)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatBRL(c.ticket_medio)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px]",
                          c.taxa_conversao >= 30 ? "bg-success/10 text-success border-success/20" :
                          c.taxa_conversao >= 15 ? "bg-warning/10 text-warning border-warning/20" :
                          "bg-destructive/10 text-destructive border-destructive/20"
                        )}
                      >
                        {c.taxa_conversao.toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.kwp_total.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.total_deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {consultores.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum dado de performance disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Sales Calendar */}
      {monthlySales.length > 0 && (
        <Card className="rounded-xl border-border/60">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Fechamentos por Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {monthlySales.map(m => {
                const [year, month] = m.month.split("-");
                const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const label = `${monthNames[parseInt(month) - 1]} ${year}`;
                
                return (
                  <div key={m.month} className="rounded-lg border border-border/40 bg-muted/20 p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-lg font-bold font-mono text-foreground">{m.count}</p>
                    <Badge variant="outline" className="text-[9px] font-mono mt-1">{formatBRL(m.value)}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
