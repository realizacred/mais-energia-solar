/**
 * EnergyFinancialPage — Admin view for energy financial metrics.
 * §26: Header with icon. §27: KPI cards. §5: Recharts with semantic tokens.
 */
import { DollarSign, TrendingUp, Users, Sun, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui-kit/StatCard";
import {
  useEnergyFinancialOverview,
  useEnergyFinancialRanking,
  useEnergyFinancialHistory,
} from "@/hooks/useEnergyFinancial";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Tooltip ────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.name.includes("R$") ? formatBRL(p.value) : `${Number(p.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh`}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────

export function EnergyFinancialPage() {
  const { data: overview, isLoading: loadingOverview } = useEnergyFinancialOverview();
  const { data: ranking, isLoading: loadingRanking } = useEnergyFinancialRanking(10);
  const { data: history, isLoading: loadingHistory } = useEnergyFinancialHistory(12);

  return (
    <div className="space-y-6">
      {/* §26: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Financeiro da Energia</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe economia, compensação e valor gerado por clientes, UCs e grupos GD
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingOverview ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={DollarSign}
            label="Economia Acumulada"
            value={formatBRLCompact(overview.total_savings_brl)}
            color="success"
          />
          <StatCard
            icon={TrendingUp}
            label="Economia do Mês"
            value={formatBRLCompact(overview.current_month_savings_brl)}
            color="primary"
          />
          <StatCard
            icon={Users}
            label="Clientes com GD"
            value={overview.active_clients}
            color="info"
          />
          <StatCard
            icon={Sun}
            label="Grupos GD Ativos"
            value={overview.active_gd_groups}
            color="warning"
          />
          <StatCard
            icon={Zap}
            label="Saldo Energético"
            value={`${overview.total_credit_balance_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`}
            color="muted"
          />
        </div>
      ) : null}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Evolução Mensal da Economia</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <Skeleton className="h-[220px] w-full" />
          ) : history && history.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSavings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="savings_brl" name="Economia (R$)" stroke="hsl(var(--success))" fill="url(#gradSavings)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              Nenhum dado financeiro disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Groups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Grupos GD por Economia</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRanking ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
            ) : ranking && ranking.topGroups.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Grupo</TableHead>
                      <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.topGroups.map((g) => (
                      <TableRow key={g.gd_group_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{g.group_name}</TableCell>
                        <TableCell className="text-muted-foreground">{g.cliente_name || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">{formatBRL(g.total_savings_brl)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                Nenhum grupo com economia registrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Clientes por Economia</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRanking ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
            ) : ranking && ranking.topClients.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Grupos</TableHead>
                      <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.topClients.map((c) => (
                      <TableRow key={c.cliente_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{c.cliente_name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{c.active_groups}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">{formatBRL(c.total_savings_brl)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                Nenhum cliente com economia registrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
