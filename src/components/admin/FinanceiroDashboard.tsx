import {
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  Users,
  Award,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { formatBRL } from "@/lib/formatters";
import {
  useFinanceiroKpis,
  useRecebimentosRecentes,
  useComissoesRecentes,
  useFinanceiroMensal,
} from "@/hooks/useFinanceiroDashboard";

// ── Custom tooltip (§5) ──
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ── KPI card (§27) ──
function KpiCard({
  icon: Icon,
  label,
  value,
  borderColor,
  iconBg,
  isLoading,
}: {
  icon: any;
  label: string;
  value: number;
  borderColor: string;
  iconBg: string;
  isLoading: boolean;
}) {
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-24 mb-1" />
              <Skeleton className="h-4 w-20" />
            </>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {formatBRL(value)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Status badge ──
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    pago: "bg-success/10 text-success border-success/20",
    pendente: "bg-warning/10 text-warning border-warning/20",
    atrasado: "bg-destructive/10 text-destructive border-destructive/20",
    cancelado: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge className={`text-xs ${config[status] || config.pendente}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function FinanceiroDashboard() {
  const navigate = useNavigate();

  const { data: kpis, isLoading: kpisLoading } = useFinanceiroKpis();
  const { data: recebimentos, isLoading: recLoading } = useRecebimentosRecentes();
  const { data: comissoes, isLoading: comLoading } = useComissoesRecentes();
  const { data: chartData, isLoading: chartLoading } = useFinanceiroMensal();

  const isEmpty = !kpisLoading && kpis && kpis.receita_total === 0 && kpis.comissoes_pagas === 0 && kpis.comissoes_pendentes === 0;

  return (
    <div className="space-y-6">
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de receitas e comissões</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/recebimentos")}>
            Recebimentos
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/comissoes")}>
            Comissões
          </Button>
        </div>
      </div>

      {/* KPIs §27 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Receita total" value={kpis?.receita_total || 0} borderColor="border-l-primary" iconBg="bg-primary/10 text-primary" isLoading={kpisLoading} />
        <KpiCard icon={Clock} label="A receber" value={kpis?.receita_pendente || 0} borderColor="border-l-warning" iconBg="bg-warning/10 text-warning" isLoading={kpisLoading} />
        <KpiCard icon={CheckCircle} label="Recebido" value={kpis?.receita_paga || 0} borderColor="border-l-success" iconBg="bg-success/10 text-success" isLoading={kpisLoading} />
        <KpiCard icon={Users} label="Comissões pendentes" value={kpis?.comissoes_pendentes || 0} borderColor="border-l-destructive" iconBg="bg-destructive/10 text-destructive" isLoading={kpisLoading} />
        <KpiCard icon={Award} label="Comissões pagas" value={kpis?.comissoes_pagas || 0} borderColor="border-l-success" iconBg="bg-success/10 text-success" isLoading={kpisLoading} />
        <KpiCard icon={AlertTriangle} label="Inadimplência" value={kpis?.parcelas_atrasadas || 0} borderColor="border-l-destructive" iconBg="bg-destructive/10 text-destructive" isLoading={kpisLoading} />
      </div>

      {/* Empty state */}
      {isEmpty && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-4">💰</span>
            <p className="text-lg font-semibold text-foreground mb-1">Nenhum dado financeiro ainda</p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Configure recebimentos e comissões para começar a acompanhar suas finanças.
            </p>
            <Button onClick={() => navigate("/admin/recebimentos")}>
              Lançar recebimento <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Chart §5 */}
      {!isEmpty && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Receitas x Comissões — últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="comissoes" name="Comissões" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tables */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recebimentos recentes §4 */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">Últimos recebimentos</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/recebimentos")}>
                Ver todos <ArrowRight className="ml-1 w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !recebimentos?.length ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Nenhum recebimento registrado</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Parc.</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recebimentos.map(r => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-foreground truncate max-w-[150px]">{r.cliente_nome}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBRL(r.valor_total)}</TableCell>
                          <TableCell className="text-center">{r.numero_parcelas}x</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comissões recentes §4 */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground">Últimas comissões</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin/comissoes")}>
                Ver todos <ArrowRight className="ml-1 w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {comLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !comissoes?.length ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Nenhuma comissão registrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold text-foreground">Consultor</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">%</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comissoes.map(c => (
                        <TableRow key={c.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-foreground truncate max-w-[150px]">{c.consultor_nome}</TableCell>
                          <TableCell className="text-right text-sm">{c.percentual_comissao}%</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBRL(c.valor_comissao)}</TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
