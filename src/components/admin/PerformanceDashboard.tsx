import { formatBRLInteger as formatBRL, formatBRLCompact as formatCompact } from "@/lib/formatters";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  BarChart3,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  Zap,
  Trophy,
  Target,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────

interface Lead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  consultor: string | null;
  consultor_id: string | null;
  created_at: string;
  status_id: string | null;
  motivo_perda_id: string | null;
  valor_estimado: number | null;
}

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface MotivoPerda {
  id: string;
  nome: string;
}

interface Consultor {
  id: string;
  nome: string;
}

interface Deal {
  id: string;
  owner_id: string;
  deal_value: number;
  deal_status: string;
  created_at: string;
  kwp: number;
}

// ── Constants ─────────────────────────────────────────────────

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
];

const RANKING_BADGES: Record<number, { label: string; className: string }> = {
  0: { label: "🥇", className: "bg-amber-100 text-amber-800 border-amber-300" },
  1: { label: "🥈", className: "bg-slate-100 text-slate-700 border-slate-300" },
  2: { label: "🥉", className: "bg-orange-100 text-orange-700 border-orange-300" },
};

const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ── Helpers ───────────────────────────────────────────────────

// formatBRL & formatCompact imported at file top from @/lib/formatters

// ── Component ─────────────────────────────────────────────────

export default function PerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [motivos, setMotivos] = useState<MotivoPerda[]>([]);
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const [leadsRes, statusRes, motivosRes, consultoresRes, dealsRes] = await Promise.all([
        supabase.from("leads").select("id, nome, estado, cidade, media_consumo, consultor, consultor_id, created_at, status_id, motivo_perda_id, valor_estimado").order("created_at", { ascending: false }).limit(2000),
        supabase.from("lead_status").select("id, nome, cor, ordem").order("ordem"),
        supabase.from("motivos_perda").select("id, nome").eq("ativo", true),
        supabase.from("consultores").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("deal_kanban_projection").select("deal_id, owner_id, deal_value, deal_status, last_stage_change, deal_kwp").limit(1000),
      ]);

      if (leadsRes.data) setLeads(leadsRes.data);
      if (statusRes.data) setStatuses(statusRes.data);
      if (motivosRes.data) setMotivos(motivosRes.data);
      if (consultoresRes.data) setConsultores(consultoresRes.data);
      if (dealsRes.data) setDeals(dealsRes.data.map((d: any) => ({
        id: d.deal_id,
        owner_id: d.owner_id,
        deal_value: d.deal_value || 0,
        deal_status: d.deal_status,
        created_at: d.last_stage_change,
        kwp: d.deal_kwp || 0,
      })));
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Derived Data ──────────────────────────────────────────

  const closedStatusIds = useMemo(() =>
    statuses.filter(s =>
      s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu") || s.nome.toLowerCase().includes("ganho")
    ).map(s => s.id),
    [statuses]
  );

  const lostStatusIds = useMemo(() =>
    statuses.filter(s =>
      s.nome.toLowerCase().includes("perdido") || s.nome.toLowerCase().includes("perda")
    ).map(s => s.id),
    [statuses]
  );

  // ── KPI Cards ─────────────────────────────────────────────

  const kpis = useMemo(() => {
    const closedLeads = leads.filter(l => closedStatusIds.includes(l.status_id || ""));
    const totalValue = deals.reduce((s, d) => s + d.deal_value, 0);
    const wonDeals = deals.filter(d => d.deal_status === "ganho" || d.deal_status === "won");
    const wonValue = wonDeals.reduce((s, d) => s + d.deal_value, 0);

    // Avg cycle time (days from created to closed)
    const cycleTimes = closedLeads
      .filter(l => l.created_at)
      .map(l => differenceInDays(new Date(), new Date(l.created_at)))
      .filter(d => d > 0 && d < 365);
    const avgCycle = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length) : 0;

    // CPL estimate
    const thisMonthLeads = leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= startOfMonth(new Date());
    }).length;

    const conversionRate = leads.length > 0 ? Math.round((closedLeads.length / leads.length) * 100) : 0;

    const ticketMedio = wonDeals.length > 0 ? wonValue / wonDeals.length : 0;

    return {
      totalLeads: leads.length,
      closedLeads: closedLeads.length,
      conversionRate,
      avgCycle,
      ticketMedio,
      totalPipeline: totalValue,
      wonValue,
      thisMonthLeads,
    };
  }, [leads, deals, closedStatusIds]);

  // ── Vendor Rankings ───────────────────────────────────────

  const vendorRanking = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      totalLeads: number;
      closedLeads: number;
      totalValue: number;
      totalKwp: number;
    }>();

    // Initialize from consultores
    consultores.forEach(c => {
      map.set(c.id, { nome: c.nome, totalLeads: 0, closedLeads: 0, totalValue: 0, totalKwp: 0 });
    });

    // Count leads by consultor
    leads.forEach(l => {
      if (l.consultor_id && map.has(l.consultor_id)) {
        const entry = map.get(l.consultor_id)!;
        entry.totalLeads++;
        if (closedStatusIds.includes(l.status_id || "")) entry.closedLeads++;
      } else if (l.consultor) {
        // Fallback to name-based matching
        const match = consultores.find(c => c.nome === l.consultor);
        if (match && map.has(match.id)) {
          const entry = map.get(match.id)!;
          entry.totalLeads++;
          if (closedStatusIds.includes(l.status_id || "")) entry.closedLeads++;
        }
      }
    });

    // Add deal values
    deals.forEach(d => {
      if (map.has(d.owner_id)) {
        const entry = map.get(d.owner_id)!;
        entry.totalValue += d.deal_value;
        entry.totalKwp += d.kwp;
      }
    });

    return Array.from(map.values())
      .filter(v => v.totalLeads > 0 || v.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue || b.closedLeads - a.closedLeads);
  }, [leads, deals, consultores, closedStatusIds]);

  // ── Monthly Sales Grid ────────────────────────────────────

  const monthlySales = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = subMonths(now, i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);

      const monthLeads = leads.filter(l => {
        const d = new Date(l.created_at);
        return isWithinInterval(d, { start, end });
      });

      const closed = monthLeads.filter(l => closedStatusIds.includes(l.status_id || "")).length;
      const totalKwh = monthLeads.reduce((s, l) => s + l.media_consumo, 0);

      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: MONTHS_PT[date.getMonth()],
        fullLabel: format(date, "MMMM yyyy", { locale: ptBR }),
        totalLeads: monthLeads.length,
        closedLeads: closed,
        totalKwh,
      });
    }
    return months;
  }, [leads, closedStatusIds]);

  // ── Loss Reasons ──────────────────────────────────────────

  const lossReasons = useMemo(() => {
    const lostLeads = leads.filter(l => l.motivo_perda_id);
    const countByMotivo = new Map<string, number>();
    lostLeads.forEach(l => {
      const count = countByMotivo.get(l.motivo_perda_id!) || 0;
      countByMotivo.set(l.motivo_perda_id!, count + 1);
    });

    return Array.from(countByMotivo.entries())
      .map(([id, count]) => ({
        name: motivos.find(m => m.id === id)?.nome || "Outro",
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [leads, motivos]);

  // ── Monthly Leads Chart Data ──────────────────────────────

  const monthlyChartData = useMemo(() =>
    monthlySales.slice(-6).map(m => ({
      name: m.label,
      leads: m.totalLeads,
      vendas: m.closedLeads,
    })),
    [monthlySales]
  );

  if (loading) return <LoadingState message="Carregando dashboard de performance..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Dashboard de Performance"
        description="Métricas de vendas, conversão e rendimento da equipe"
      />

      {/* ── KPI Cards (scrollable on mobile) ── */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-2" style={{ minWidth: "max-content" }}>
          <KpiCard
            icon={<Clock className="h-5 w-5 text-info" />}
            label="Ciclo de Venda"
            value={`${kpis.avgCycle} dias`}
            color="border-l-info"
          />
          <KpiCard
            icon={<DollarSign className="h-5 w-5 text-success" />}
            label="Ticket Médio"
            value={formatCompact(kpis.ticketMedio)}
            color="border-l-success"
          />
          <KpiCard
            icon={<Target className="h-5 w-5 text-primary" />}
            label="Taxa de Conversão"
            value={`${kpis.conversionRate}%`}
            sub={`${kpis.closedLeads} de ${kpis.totalLeads}`}
            color="border-l-primary"
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-warning" />}
            label="Pipeline Total"
            value={formatCompact(kpis.totalPipeline)}
            sub={`${kpis.wonValue > 0 ? formatCompact(kpis.wonValue) + " ganho" : ""}`}
            color="border-l-warning"
          />
          <KpiCard
            icon={<Users className="h-5 w-5 text-secondary" />}
            label="Leads este Mês"
            value={String(kpis.thisMonthLeads)}
            color="border-l-secondary"
          />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ── Main Content ── */}
      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="ranking" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="h-4 w-4" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" /> Mensal
          </TabsTrigger>
          <TabsTrigger value="losses" className="gap-1.5 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4" /> Perdas
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" /> Funil
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: Ranking ── */}
        <TabsContent value="ranking" className="mt-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Resumo de Rendimento
              </CardTitle>
              <CardDescription>Performance dos consultores por faturamento e conversão</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">#</TableHead>
                      <TableHead>Consultor</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Ticket Médio</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">kWp Total</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendorRanking.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    )}
                    {vendorRanking.map((vendor, i) => {
                      const conversion = vendor.totalLeads > 0
                        ? Math.round((vendor.closedLeads / vendor.totalLeads) * 100)
                        : 0;
                      const ticketMedio = vendor.closedLeads > 0
                        ? vendor.totalValue / vendor.closedLeads
                        : 0;
                      const ranking = RANKING_BADGES[i];

                      return (
                        <TableRow key={vendor.nome} className="group">
                          <TableCell>
                            {ranking ? (
                              <Badge variant="outline" className={cn("text-xs font-bold", ranking.className)}>
                                {ranking.label}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground font-mono">{i + 1}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                                  {vendor.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium truncate max-w-[140px]">{vendor.nome}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                            {formatBRL(vendor.totalValue)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                            {formatBRL(ticketMedio)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {vendor.totalLeads}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                            {vendor.totalKwp > 0 ? `${vendor.totalKwp.toFixed(1)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-xs",
                                conversion >= 30 ? "bg-success/10 text-success border-success/30" :
                                conversion >= 15 ? "bg-warning/10 text-warning border-warning/30" :
                                "bg-muted text-muted-foreground"
                              )}
                            >
                              {conversion}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Monthly Grid ── */}
        <TabsContent value="calendar" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Sales Grid */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Vendas por Mês
                </CardTitle>
                <CardDescription>Últimos 12 meses de operação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {monthlySales.map(m => (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {m.label} {m.year !== new Date().getFullYear() ? `'${String(m.year).slice(-2)}` : ""}
                      </span>
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                        m.closedLeads > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {m.closedLeads}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(m.totalKwh / 1000).toFixed(1)}k kWh
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {m.totalLeads} leads
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monthly Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Evolução (6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid hsl(var(--border))",
                          backgroundColor: "hsl(var(--card))",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Bar dataKey="leads" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name="Leads" />
                      <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB: Losses ── */}
        <TabsContent value="losses" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Motivos de Perda
                </CardTitle>
                <CardDescription>Distribuição dos principais motivos</CardDescription>
              </CardHeader>
              <CardContent>
                {lossReasons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum motivo de perda registrado</p>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lossReasons}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {lossReasons.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            backgroundColor: "hsl(var(--card))",
                            color: "hsl(var(--foreground))",
                          }}
                          formatter={(value) => [value, "Leads"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loss Details List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Detalhamento</CardTitle>
                <CardDescription>Leads perdidos por motivo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {lossReasons.map((reason, i) => {
                    const total = lossReasons.reduce((s, r) => s + r.value, 0);
                    const pct = total > 0 ? Math.round((reason.value / total) * 100) : 0;
                    return (
                      <div key={reason.name} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{reason.name}</p>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold font-mono text-foreground">{reason.value}</span>
                          <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  {lossReasons.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB: Funnel Speed ── */}
        <TabsContent value="funnel" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-secondary" />
                  Distribuição por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {statuses.sort((a, b) => a.ordem - b.ordem).map(status => {
                    const count = leads.filter(l => l.status_id === status.id).length;
                    const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                    return (
                      <div key={status.id} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.cor }} />
                        <span className="text-sm flex-1 truncate">{status.nome}</span>
                        <span className="text-sm font-bold font-mono text-foreground">{count}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                    <div className="w-3 h-3 rounded-full bg-muted shrink-0" />
                    <span className="text-sm flex-1 text-muted-foreground">Sem status</span>
                    <span className="text-sm font-bold font-mono">{leads.filter(l => !l.status_id).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Funnel KPIs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Inteligência de Funil
                </CardTitle>
                <CardDescription>Métricas de velocidade e eficiência</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-3xl font-bold font-mono text-foreground">{kpis.avgCycle}</p>
                    <p className="text-xs text-muted-foreground mt-1">Ciclo médio (dias)</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-3xl font-bold font-mono text-primary">{kpis.conversionRate}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Taxa de conversão</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-3xl font-bold font-mono text-success">{formatCompact(kpis.ticketMedio)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Ticket Médio</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-3xl font-bold font-mono text-foreground">{kpis.totalLeads}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total no pipeline</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-primary">{formatCompact(kpis.wonValue)}</p>
                    <p className="text-sm text-muted-foreground mt-1">Faturamento Total (Ganho)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── KPI Card Sub-component ────────────────────────────────────

function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Card className={cn("min-w-[180px] border-l-4", color)}>
      <CardContent className="flex items-center gap-3 pt-5 pb-4 px-4">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold font-mono text-foreground leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
