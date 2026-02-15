import { useState, useMemo } from "react";
import {
  MessageCircle,
  Clock,
  TrendingUp,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

// ── Mock Data (ready for useSolarZapMetrics hook) ──

const MOCK_HOURLY_VOLUME = [
  { hour: "08h", msgs: 12 },
  { hour: "09h", msgs: 34 },
  { hour: "10h", msgs: 58 },
  { hour: "11h", msgs: 45 },
  { hour: "12h", msgs: 22 },
  { hour: "13h", msgs: 18 },
  { hour: "14h", msgs: 52 },
  { hour: "15h", msgs: 61 },
  { hour: "16h", msgs: 47 },
  { hour: "17h", msgs: 38 },
  { hour: "18h", msgs: 15 },
];

const MOCK_CHANNELS = [
  { name: "WhatsApp", value: 72, fill: "hsl(var(--success))" },
  { name: "Instagram", value: 20, fill: "hsl(var(--info))" },
  { name: "Webchat", value: 8, fill: "hsl(var(--warning))" },
];

const MOCK_RANKING = [
  { id: "1", nome: "Carlos Silva", avatar: "CS", chatsAtivos: 8, tmr: "3m 22s", vendas: 42500, topSeller: true },
  { id: "2", nome: "Ana Souza", avatar: "AS", chatsAtivos: 6, tmr: "5m 10s", vendas: 38200, topSeller: false },
  { id: "3", nome: "Pedro Lima", avatar: "PL", chatsAtivos: 4, tmr: "2m 48s", vendas: 29800, topSeller: false },
  { id: "4", nome: "Maria Oliveira", avatar: "MO", chatsAtivos: 7, tmr: "8m 05s", vendas: 22100, topSeller: false },
  { id: "5", nome: "Lucas Mendes", avatar: "LM", chatsAtivos: 3, tmr: "12m 30s", vendas: 15600, topSeller: false },
];

const PERIOD_OPTIONS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "mes", label: "Este Mês" },
];

const barChartConfig: ChartConfig = {
  msgs: { label: "Mensagens", color: "hsl(var(--primary))" },
};

// ── KPI Card ──

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  delta?: string;
  deltaType?: "positive" | "negative" | "neutral";
  alert?: boolean;
}

function KpiCard({ icon: Icon, label, value, delta, deltaType = "neutral", alert }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-2xl font-bold font-mono tabular-nums truncate ${alert ? "text-destructive" : "text-foreground"}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
        {delta && (
          <Badge
            variant="outline"
            className={`text-[10px] gap-0.5 shrink-0 ${
              deltaType === "positive"
                ? "text-success border-success/30"
                : deltaType === "negative"
                ? "text-destructive border-destructive/30"
                : "text-muted-foreground"
            }`}
          >
            {deltaType === "positive" ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : deltaType === "negative" ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : null}
            {delta}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ──

export function SolarZapDashboard() {
  const [period, setPeriod] = useState("hoje");

  // Mock KPI values — ready for hook replacement
  const kpis = useMemo(
    () => ({
      atendimentos: { value: "127", delta: "+12%", deltaType: "positive" as const },
      tmr: { value: "4m 12s", alert: false, delta: "-18%", deltaType: "positive" as const },
      conversao: { value: "23,4%", delta: "+3,2pp", deltaType: "positive" as const },
      csat: { value: "8.7", delta: "-0.2", deltaType: "negative" as const },
    }),
    [period],
  );

  return (
    <div className="space-y-6">
      {/* Header + Period Filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dashboard SolarZap</h2>
          <p className="text-xs text-muted-foreground">Métricas de atendimento em tempo real</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={MessageCircle}
          label="Atendimentos Hoje"
          value={kpis.atendimentos.value}
          delta={kpis.atendimentos.delta}
          deltaType={kpis.atendimentos.deltaType}
        />
        <KpiCard
          icon={Clock}
          label="T.M.R. (Tempo Médio de Resposta)"
          value={kpis.tmr.value}
          alert={kpis.tmr.alert}
          delta={kpis.tmr.delta}
          deltaType={kpis.tmr.deltaType}
        />
        <KpiCard
          icon={TrendingUp}
          label="Taxa de Conversão"
          value={kpis.conversao.value}
          delta={kpis.conversao.delta}
          deltaType={kpis.conversao.deltaType}
        />
        <KpiCard
          icon={Star}
          label="Satisfação (CSAT)"
          value={kpis.csat.value}
          delta={kpis.csat.delta}
          deltaType={kpis.csat.deltaType}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart — Volume por Hora */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Volume de Mensagens por Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barChartConfig} className="h-[260px] w-full">
              <BarChart data={MOCK_HOURLY_VOLUME} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="msgs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Pie Chart — Funil de Canais */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por Canal</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_CHANNELS}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {MOCK_CHANNELS.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {MOCK_CHANNELS.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.fill }} />
                  {c.name} <span className="font-mono font-medium text-foreground">{c.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ranking de Vendedores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Consultor</TableHead>
                <TableHead className="text-xs text-center">Chats Ativos</TableHead>
                <TableHead className="text-xs text-center">TMR</TableHead>
                <TableHead className="text-xs text-right">Vendas (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_RANKING.map((r, idx) => {
                const tmrMinutes = parseInt(r.tmr);
                const tmrAlert = tmrMinutes >= 10;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-mono text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px]">{r.avatar}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{r.nome}</span>
                        {r.topSeller && <Crown className="h-4 w-4 text-warning" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-center">{r.chatsAtivos}</TableCell>
                    <TableCell className={`text-sm font-mono text-center ${tmrAlert ? "text-destructive font-semibold" : ""}`}>
                      {r.tmr}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-right font-medium">
                      {r.vendas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
