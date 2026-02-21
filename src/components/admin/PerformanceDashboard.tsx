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
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
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
  TrendingDown,
  Clock,
  DollarSign,
  Zap,
  Trophy,
  Target,
  Calendar,
  AlertTriangle,
  ArrowRight,
  FileText,
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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

const barChartConfig: ChartConfig = {
  leads: { label: "Leads", color: "hsl(var(--secondary))" },
  vendas: { label: "Vendas", color: "hsl(var(--primary))" },
};

const pieChartConfig: ChartConfig = {
  value: { label: "Leads" },
};

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
    const now = new Date();
    const closedLeads = leads.filter(l => closedStatusIds.includes(l.status_id || ""));
    const totalValue = deals.reduce((s, d) => s + d.deal_value, 0);
    const wonDeals = deals.filter(d => d.deal_status === "ganho" || d.deal_status === "won");
    const wonValue = wonDeals.reduce((s, d) => s + d.deal_value, 0);

    // Avg cycle time (days from created to closed)
    const cycleTimes = closedLeads
      .filter(l => l.created_at)
      .map(l => differenceInDays(now, new Date(l.created_at)))
      .filter(d => d > 0 && d < 365);
    const avgCycle = cycleTimes.length > 0 ? Math.round(cycleTimes.reduce((s, d) => s + d, 0) / cycleTimes.length) : 0;

    // This month vs last month for growth indicators
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const thisMonthLeads = leads.filter(l => new Date(l.created_at) >= thisMonthStart).length;
    const lastMonthLeads = leads.filter(l => {
      const d = new Date(l.created_at);
      return isWithinInterval(d, { start: lastMonthStart, end: lastMonthEnd });
    }).length;

    const leadsGrowth = lastMonthLeads > 0
      ? Math.round(((thisMonthLeads - lastMonthLeads) / lastMonthLeads) * 100)
      : thisMonthLeads > 0 ? 100 : 0;

    const thisMonthWon = wonDeals.filter(d => new Date(d.created_at) >= thisMonthStart);
    const lastMonthWon = wonDeals.filter(d => {
      const dt = new Date(d.created_at);
      return isWithinInterval(dt, { start: lastMonthStart, end: lastMonthEnd });
    });
    const thisMonthWonValue = thisMonthWon.reduce((s, d) => s + d.deal_value, 0);
    const lastMonthWonValue = lastMonthWon.reduce((s, d) => s + d.deal_value, 0);
    const revenueGrowth = lastMonthWonValue > 0
      ? Math.round(((thisMonthWonValue - lastMonthWonValue) / lastMonthWonValue) * 100)
      : thisMonthWonValue > 0 ? 100 : 0;

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
      leadsGrowth,
      revenueGrowth,
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

  const navigate = useNavigate();

  // Recent leads for activity feed
  const recentLeads = useMemo(() => leads.slice(0, 8), [leads]);

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
            label="Ciclo de venda"
            value={`${kpis.avgCycle} dias`}
            colorBorder="border-info/40"
            colorBg="bg-info/5"
          />
          <KpiCard
            icon={<DollarSign className="h-5 w-5 text-success" />}
            label="Ticket médio"
            value={formatCompact(kpis.ticketMedio)}
            colorBorder="border-border"
            colorBg="bg-card"
          />
          <KpiCard
            icon={<Target className="h-5 w-5 text-primary" />}
            label="Taxa de conversão"
            value={`${kpis.conversionRate}%`}
            sub={`${kpis.closedLeads} de ${kpis.totalLeads}`}
            colorBorder="border-primary/40"
            colorBg="bg-primary/5"
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5 text-warning" />}
            label="Pipeline total"
            value={formatCompact(kpis.totalPipeline)}
            sub={`${kpis.wonValue > 0 ? formatCompact(kpis.wonValue) + " ganho" : ""}`}
            colorBorder="border-warning/40"
            colorBg="bg-warning/5"
            growth={kpis.revenueGrowth}
          />
          <KpiCard
            icon={<Users className="h-5 w-5 text-secondary" />}
            label="Leads este mês"
            value={String(kpis.thisMonthLeads)}
            colorBorder="border-secondary/40"
            colorBg="bg-secondary/5"
            growth={kpis.leadsGrowth}
          />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* ── Main Content ── */}
      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="ranking" className="gap-1.5 text-xs sm:text-sm">
            <Trophy className="h-4 w-4 text-warning" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="h-4 w-4 text-primary" /> Mensal
          </TabsTrigger>
          <TabsTrigger value="losses" className="gap-1.5 text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Perdas
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4 text-info" /> Funil
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
                <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
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
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="leads" fill="var(--color-leads)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="vendas" fill="var(--color-vendas)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartContainer>
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
                  <ChartContainer config={pieChartConfig} className="h-[280px] w-full">
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
                        <ChartTooltip
                          content={<ChartTooltipContent formatter={(value) => `${value} leads`} />}
                        />
                      </PieChart>
                  </ChartContainer>
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

      {/* ── Recent Activity Feed ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Atividade Recente
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/admin/leads")}>
              Ver Todos <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <CardDescription>Últimos leads recebidos</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lead recente</p>
          ) : (
            <div className="space-y-3">
              {recentLeads.map(lead => (
                <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {lead.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.cidade && lead.estado ? `${lead.cidade}/${lead.estado}` : lead.estado || "—"} · {lead.media_consumo} kWh
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── KPI Card Sub-component ────────────────────────────────────

function KpiCard({ icon, label, value, sub, colorBorder, colorBg, growth }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  colorBorder: string;
  colorBg: string;
  growth?: number;
}) {
  return (
    <Card className={cn("min-w-[200px] rounded-xl border", colorBorder, colorBg)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-bold font-mono text-foreground leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
          {growth !== undefined && growth !== 0 && (
            <p className={cn(
              "text-[10px] font-semibold flex items-center gap-0.5 mt-0.5",
              growth > 0 ? "text-success" : "text-destructive"
            )}>
              {growth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {growth > 0 ? "+" : ""}{growth}% vs mês anterior
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
