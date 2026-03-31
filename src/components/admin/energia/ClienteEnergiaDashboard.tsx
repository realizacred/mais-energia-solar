/**
 * ClienteEnergiaDashboard — Client-facing energy dashboard.
 * Visual, intuitive, value-oriented. No technical jargon.
 * §26: Header. §27: KPI cards. §5: Recharts. §12: Skeleton.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Button } from "@/components/ui/button";
import {
  DollarSign, TrendingUp, Zap, Sun, FileText, AlertTriangle, BarChart3,
  CheckCircle2, Building2,
} from "lucide-react";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";
import {
  useClienteDashboardResumo,
  useClienteDashboardHistorico,
  useClienteDashboardUCs,
  useClienteDashboardGD,
  useClienteDashboardFaturas,
  useClienteDashboardAlertas,
} from "@/hooks/useClienteDashboard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Tooltip ────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">
            {p.name.includes("R$") ? formatBRL(p.value) : `${Number(p.value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh`}
          </span>
        </p>
      ))}
    </div>
  );
};

// ─── Props ──────────────────────────────────────────────────────

interface Props {
  clienteId: string;
}

// ─── Sections ───────────────────────────────────────────────────

function HeroSection({ clienteId }: Props) {
  const { data, isLoading } = useClienteDashboardResumo(clienteId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={DollarSign}
        label="Economia do Mês"
        value={formatBRLCompact(data.current_month_savings_brl)}
        color="success"
      />
      <StatCard
        icon={TrendingUp}
        label="Economia Acumulada"
        value={formatBRLCompact(data.total_savings_brl)}
        color="primary"
      />
      <StatCard
        icon={Zap}
        label="Compensados no Mês"
        value={`${data.total_compensated_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`}
        color="info"
      />
      <StatCard
        icon={BarChart3}
        label="Saldo de Créditos"
        value={`${data.current_credit_balance_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh`}
        color="warning"
      />
    </div>
  );
}

function ChartSection({ clienteId }: Props) {
  const { data: history, isLoading } = useClienteDashboardHistorico(clienteId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Evolução da Economia</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : history && history.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradClientSavings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="savings_brl" name="Economia (R$)" stroke="hsl(var(--success))" fill="url(#gradClientSavings)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Dados de economia ainda não disponíveis
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UCsSection({ clienteId }: Props) {
  const { data: ucs, isLoading } = useClienteDashboardUCs(clienteId);

  const papelLabels: Record<string, string> = {
    geradora: "Geradora",
    beneficiaria: "Beneficiária",
  };

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
  }

  if (!ucs || ucs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhuma unidade vinculada</p>
        <p className="text-xs text-muted-foreground mt-1">Suas unidades consumidoras aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ucs.map((uc: any) => (
        <Card key={uc.id} className="hover:shadow-md transition-shadow">
          <CardContent className="flex items-center justify-between p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{uc.codigo_uc}</p>
                {uc.nome && <span className="text-xs text-muted-foreground truncate">— {uc.nome}</span>}
                {uc.papel_gd && uc.papel_gd !== "none" && (
                  <Badge variant="outline" className="text-[10px] shrink-0">{papelLabels[uc.papel_gd] || uc.papel_gd}</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 text-right">
              {uc.compensated_kwh > 0 && (
                <div>
                  <p className="text-sm font-bold text-foreground font-mono">{uc.compensated_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
                  <p className="text-[10px] text-muted-foreground">compensado</p>
                </div>
              )}
              {uc.savings_brl > 0 && (
                <div>
                  <p className="text-sm font-bold text-success font-mono">{formatBRL(uc.savings_brl)}</p>
                  <p className="text-[10px] text-muted-foreground">economia</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GDSection({ clienteId }: Props) {
  const { data: groups, isLoading } = useClienteDashboardGD(clienteId);

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>;
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
          <Sun className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhum grupo de geração distribuída</p>
        <p className="text-xs text-muted-foreground mt-1">Seus grupos GD aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groups.map((g: any) => (
        <Card key={g.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{g.nome}</p>
                  <p className="text-[10px] text-muted-foreground">Geradora: {g.uc_geradora_label}</p>
                </div>
              </div>
              <Badge variant={g.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {g.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground">Geração</p>
                <p className="text-sm font-bold font-mono text-foreground">{g.generation_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal">kWh</span></p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground">Compensado</p>
                <p className="text-sm font-bold font-mono text-foreground">{g.compensated_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal">kWh</span></p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground">Economia</p>
                <p className="text-sm font-bold font-mono text-success">{formatBRL(g.savings_brl)}</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="text-sm font-bold font-mono text-foreground">{g.credit_balance_kwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal">kWh</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FaturasSection({ clienteId }: Props) {
  const { data: faturas, isLoading } = useClienteDashboardFaturas(clienteId);

  if (isLoading) {
    return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>;
  }

  if (!faturas || faturas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhuma fatura registrada</p>
        <p className="text-xs text-muted-foreground mt-1">Suas faturas de energia aparecerão aqui</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    paid: "Paga",
    overdue: "Atrasada",
    processed: "Processada",
    review: "Em revisão",
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Mês</TableHead>
            <TableHead className="font-semibold text-foreground">UC</TableHead>
            <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
            <TableHead className="font-semibold text-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faturas.map((f: any) => (
            <TableRow key={f.id} className="hover:bg-muted/30">
              <TableCell className="font-medium text-foreground">{f.month_label}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{f.uc_label}</TableCell>
              <TableCell className="text-right font-mono text-sm">{f.total_amount != null ? formatBRL(Number(f.total_amount)) : "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px]">{statusLabels[f.status] || f.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AlertsSection({ clienteId }: Props) {
  const { data: alerts, isLoading } = useClienteDashboardAlertas(clienteId);

  if (isLoading) return <Skeleton className="h-16 w-full rounded-lg" />;

  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/20">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Tudo certo!</p>
          <p className="text-xs text-muted-foreground">Não há alertas pendentes para suas unidades</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a: any) => (
        <div
          key={a.id}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            a.severity === "critical"
              ? "bg-destructive/5 border-destructive/20"
              : "bg-warning/5 border-warning/20"
          }`}
        >
          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
            a.severity === "critical" ? "text-destructive" : "text-warning"
          }`} />
          <div>
            <p className="text-sm font-medium text-foreground">{a.title}</p>
            {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────

export function ClienteEnergiaDashboard({ clienteId }: Props) {
  return (
    <div className="space-y-6">
      {/* §26: Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Meu Painel de Energia</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe economia, créditos, faturas e desempenho da sua operação
          </p>
        </div>
      </div>

      {/* Alerts */}
      <AlertsSection clienteId={clienteId} />

      {/* Hero KPIs */}
      <HeroSection clienteId={clienteId} />

      {/* Chart */}
      <ChartSection clienteId={clienteId} />

      {/* Tabs for details */}
      <Tabs defaultValue="ucs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ucs">Minhas UCs</TabsTrigger>
          <TabsTrigger value="gd">Minha GD</TabsTrigger>
          <TabsTrigger value="faturas">Faturas</TabsTrigger>
        </TabsList>

        <TabsContent value="ucs">
          <UCsSection clienteId={clienteId} />
        </TabsContent>

        <TabsContent value="gd">
          <GDSection clienteId={clienteId} />
        </TabsContent>

        <TabsContent value="faturas">
          <FaturasSection clienteId={clienteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
