/**
 * Phase 4B — Analytics Comercial (somente leitura).
 *
 * Reaproveita useFollowupComercialAnalytics. Sem queries inline, sem novas tabelas.
 * Charts via recharts (já no projeto). Tokens semânticos, dark-mode safe.
 */
import { useMemo } from "react";
import {
  AlertTriangle, BarChart3, CheckCircle2, Clock, Flame, Inbox,
  RefreshCw, Send, ShieldAlert, Sparkles, TrendingUp, XCircle, Users,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui-kit/StatCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { useFollowupComercialAnalytics } from "@/hooks/useFollowupComercialAnalytics";
import { formatDiasParado } from "@/lib/formatters/diasParado";

const PIE_COLORS = [
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--info))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
];

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviados",
  delivered: "Entregues",
  failed: "Falhas",
  queued: "Em fila",
  pending: "Pendentes",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatPct(v: number) {
  return `${v.toFixed(1)}%`;
}

function formatShortDate(iso: string) {
  // YYYY-MM-DD → DD/MM
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground p-2 text-xs shadow-md">
      {label && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function FollowupComercialAnalytics() {
  const { data, isLoading, isError, error, refetch, isFetching } = useFollowupComercialAnalytics();

  const empty = useMemo(
    () =>
      !isLoading &&
      !isError &&
      data &&
      data.enviados30d === 0 &&
      data.totalRecuperacao === 0,
    [isLoading, isError, data]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Skeleton className="h-[260px] rounded-lg" />
          <Skeleton className="h-[260px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-l-[3px] border-l-destructive">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Falha ao carregar analytics: {(error as Error)?.message ?? "erro desconhecido"}
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || empty) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Sem dados de analytics"
        description="Quando houver tentativas de follow-up nos últimos 30 dias, as métricas aparecerão aqui."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Refresh */}
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Inbox}       label="Em recuperação"    value={data.totalRecuperacao} color="primary" />
        <StatCard icon={TrendingUp}  label="Valor potencial"   value={formatBRL(data.valorPotencial)} color="success" />
        <StatCard icon={Send}        label="Enviados hoje"     value={data.enviadosHoje} color="info" />
        <StatCard icon={Send}        label="Enviados 7d"       value={data.enviados7d} color="info" />
        <StatCard icon={CheckCircle2} label="Taxa de envio"    value={formatPct(data.taxaSucesso)} color="success" />
        <StatCard icon={XCircle}      label="Taxa de falha"    value={formatPct(data.taxaFalha)} color="destructive" />
        <StatCard icon={Clock}        label="Cooldowns ativos" value={data.cooldownsAtivos} color="warning" />
        <StatCard icon={ShieldAlert}  label="Opt-outs"         value={data.optOuts} color="muted" />
      </div>

      {/* Linha secundária */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Taxa de resposta
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {formatPct(data.taxaResposta)}
            </div>
            <Progress value={Math.min(100, data.taxaResposta)} className="h-1.5" />
            <div className="text-[11px] text-muted-foreground">
              Respostas / enviados nos últimos 30d
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> Envios forçados (30d)
            </div>
            <div className="text-2xl font-semibold text-foreground">{data.forcedCount30d}</div>
            <div className="text-[11px] text-muted-foreground">
              Override de cooldown / cap / max attempts
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Tempo médio parado
            </div>
            <div className="text-2xl font-semibold text-foreground">
              {formatDiasParado(data.diasParadoMedio)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Média na inbox de recuperação
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de evolução diária */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Evolução diária (30d)</h3>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  content={<ChartTooltip />}
                  labelFormatter={(l) => formatShortDate(String(l))}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone" dataKey="sent" name="Enviados"
                  stroke="hsl(var(--success))" strokeWidth={2} dot={false}
                />
                <Line
                  type="monotone" dataKey="failed" name="Falhas"
                  stroke="hsl(var(--destructive))" strokeWidth={2} dot={false}
                />
                <Line
                  type="monotone" dataKey="responded" name="Respostas"
                  stroke="hsl(var(--info))" strokeWidth={2} dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribuições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por status</h3>
            {data.byStatus.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">
                Sem tentativas no período.
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.byStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%" cy="50%" outerRadius={70}
                      label={(e: any) => STATUS_LABEL[e.status] ?? e.status}
                    >
                      {data.byStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={<ChartTooltip />}
                      formatter={(v: any, n: any) => [v, STATUS_LABEL[n] ?? n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por modo</h3>
            {data.byMode.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center">
                Sem tentativas no período.
              </div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byMode}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mode" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Tentativas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top consultores */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Top consultores (30d)</h3>
          </div>
          {data.topConsultores.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              Nenhum consultor com envios no período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left py-2">Consultor</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2">Enviados</th>
                    <th className="text-right py-2">Falhas</th>
                    <th className="text-right py-2">Forçados</th>
                    <th className="text-right py-2 w-[140px]">Sucesso</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topConsultores.map((c) => (
                    <tr key={c.consultor_id} className="border-t border-border">
                      <td className="py-2 text-foreground truncate max-w-[240px]">
                        {c.nome ?? <span className="text-muted-foreground italic">sem nome</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{c.total}</td>
                      <td className="py-2 text-right tabular-nums text-success-foreground">{c.sent}</td>
                      <td className="py-2 text-right tabular-nums text-destructive">{c.failed}</td>
                      <td className="py-2 text-right tabular-nums">
                        {c.forced > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-destructive/40 text-destructive bg-destructive/5 text-[10px]"
                          >
                            {c.forced}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={c.sucesso} className="h-1.5 w-16" />
                          <span className="text-xs tabular-nums w-12 text-right">{formatPct(c.sucesso)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
