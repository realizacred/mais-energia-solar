/**
 * AsaasConversionPage — Dashboard for Asaas configuration funnel metrics.
 * §26: PageHeader. §27: KPI cards. §4: Table. §5: Chart. §16: queries in hooks.
 */
import { useState, useMemo } from "react";
import { BarChart3, Eye, MousePointerClick, CheckCircle2, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useAsaasConversionMetrics } from "@/hooks/useAsaasConversionMetrics";

/* ─── KPI Card ─── */
function KpiCard({
  icon: Icon,
  value,
  label,
  borderColor,
  bgColor,
  loading,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  borderColor: string;
  bgColor: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </Card>
    );
  }
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor} shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Chart Tooltip ─── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <span className="font-semibold text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

/* ─── Page ─── */
export default function AsaasConversionPage() {
  const [tenantFilter, setTenantFilter] = useState("");
  const [contextFilter, setContextFilter] = useState<string>("all");

  const { data, isLoading } = useAsaasConversionMetrics({
    tenantId: tenantFilter || undefined,
    context: contextFilter !== "all" ? contextFilter : undefined,
  });

  const kpis = data?.kpis;
  const tenantRows = data?.tenantRows ?? [];
  const dailyChart = data?.dailyChart ?? [];

  const uniqueContexts = useMemo(() => {
    const set = new Set(tenantRows.map((r) => r.context));
    return Array.from(set).sort();
  }, [tenantRows]);

  return (
    <div className="w-full space-y-6">
      {/* §26: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Conversão de Configuração Asaas</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe visualizações, cliques e ativações da integração
            </p>
          </div>
        </div>
      </div>

      {/* §27: KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Eye}
          value={kpis?.total_views ?? 0}
          label="Visualizações"
          borderColor="border-l-primary"
          bgColor="bg-primary/10 text-primary"
          loading={isLoading}
        />
        <KpiCard
          icon={MousePointerClick}
          value={kpis?.total_clicks ?? 0}
          label="Cliques"
          borderColor="border-l-warning"
          bgColor="bg-warning/10 text-warning"
          loading={isLoading}
        />
        <KpiCard
          icon={CheckCircle2}
          value={kpis?.total_configured ?? 0}
          label="Configurados"
          borderColor="border-l-success"
          bgColor="bg-success/10 text-success"
          loading={isLoading}
        />
        <KpiCard
          icon={Percent}
          value={`${kpis?.conversion_rate ?? 0}%`}
          label="Taxa de conversão"
          borderColor="border-l-info"
          bgColor="bg-info/10 text-info"
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Filtrar por tenant ID..."
          value={tenantFilter}
          onChange={(e) => setTenantFilter(e.target.value)}
          className="w-64"
        />
        <Select value={contextFilter} onValueChange={setContextFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Contexto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contextos</SelectItem>
            {uniqueContexts.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* §5: Chart */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Evolução diária</h2>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : dailyChart.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Nenhum dado de funil registrado ainda.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradConfigured" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="views" name="Views" stroke="hsl(var(--primary))" fill="url(#gradViews)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="clicks" name="Clicks" stroke="hsl(var(--warning))" fill="url(#gradClicks)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="configured" name="Configured" stroke="hsl(var(--success))" fill="url(#gradConfigured)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* §4: Table */}
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold text-foreground">Tenant</TableHead>
              <TableHead className="font-semibold text-foreground">Contexto</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Views</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Clicks</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Configured</TableHead>
              <TableHead className="font-semibold text-foreground text-right">Conversão</TableHead>
              <TableHead className="font-semibold text-foreground">Última atividade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : tenantRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum evento registrado ainda.
                </TableCell>
              </TableRow>
            ) : (
              tenantRows.map((row) => (
                <TableRow key={`${row.tenant_id}::${row.context}`} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-foreground">{row.tenant_id.substring(0, 8)}…</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{row.context}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.views}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.clicks}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.configured}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.conversion}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.last_activity).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
