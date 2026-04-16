import { useState } from "react";
import {
  BarChart3, Eye, CheckCircle2, XCircle, Send, Flame, Clock, TrendingUp, Users, FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useProposalFunnel } from "@/hooks/useProposalFunnel";
import { formatBRL } from "@/lib/formatters";

// §27-S1: KPI Card
function KpiCard({ icon: Icon, label, value, borderColor = "border-l-primary", iconBg = "bg-primary/10 text-primary" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  borderColor?: string;
  iconBg?: string;
}) {
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg} shrink-0`}>
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

// Funnel bar visualization
function FunnelBar({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value} <span className="text-muted-foreground font-normal">({pct.toFixed(1)}%)</span></span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
    </div>
  );
}

export default function ProposalFunnelDashboard() {
  const [days, setDays] = useState(30);
  const { metrics, vendors, hotProposals } = useProposalFunnel(days);
  const m = metrics.data;
  const isLoading = metrics.isLoading;

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      {/* §26-S1: Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Funil Comercial</h1>
            <p className="text-sm text-muted-foreground">Métricas de propostas e conversão</p>
          </div>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Send} label="Propostas Enviadas" value={m?.total_enviadas ?? 0} />
          <KpiCard icon={Eye} label="Taxa de Visualização" value={`${m?.taxa_visualizacao ?? 0}%`}
            borderColor="border-l-info" iconBg="bg-info/10 text-info" />
          <KpiCard icon={TrendingUp} label="Taxa de Conversão" value={`${m?.taxa_conversao ?? 0}%`}
            borderColor="border-l-success" iconBg="bg-success/10 text-success" />
          <KpiCard icon={Flame} label="Propostas Quentes" value={m?.propostas_quentes ?? 0}
            borderColor="border-l-warning" iconBg="bg-warning/10 text-warning" />
        </div>
      )}

      {/* Funnel + Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Visualization */}
        <Card className="bg-card">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Funil de Propostas
            </h2>
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                <FunnelBar label="Geradas" value={m?.total_geradas ?? 0} total={m?.total_geradas ?? 1} color="bg-primary" />
                <FunnelBar label="Enviadas" value={m?.total_enviadas ?? 0} total={m?.total_geradas ?? 1} color="bg-primary/80" />
                <FunnelBar label="Visualizadas" value={m?.total_vistas ?? 0} total={m?.total_geradas ?? 1} color="bg-info" />
                <FunnelBar label="Aceitas" value={m?.total_aceitas ?? 0} total={m?.total_geradas ?? 1} color="bg-success" />
                <FunnelBar label="Recusadas" value={m?.total_recusadas ?? 0} total={m?.total_geradas ?? 1} color="bg-destructive" />
              </div>
            )}
            {m?.avg_tempo_abertura_horas != null && (
              <div className="flex items-center gap-2 pt-2 border-t border-border text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Tempo médio até abertura: <span className="font-semibold text-foreground">{m.avg_tempo_abertura_horas}h</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hot Proposals */}
        <Card className="bg-card">
          <CardContent className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-warning" /> Propostas Quentes
              <Badge variant="outline" className="ml-auto text-xs">{hotProposals.data?.length ?? 0}</Badge>
            </h2>
            {hotProposals.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !hotProposals.data?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma proposta quente no período</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {hotProposals.data.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.cliente_nome || p.titulo || p.codigo}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.potencia_kwp} kWp • {formatBRL(p.valor_total)} • {p.vendedor || "—"}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 shrink-0">
                      <Eye className="h-3 w-3 mr-1" />{p.total_aberturas}x
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card className="bg-card">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Propostas por Vendedor
          </h2>
          {vendors.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !vendors.data?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no período</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Vendedor</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Total</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Aceitas</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Pendentes</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Valor Aceito</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.data.map((v, i) => (
                    <TableRow key={v.vendedor_id || i} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{v.vendedor || "Sem vendedor"}</TableCell>
                      <TableCell className="text-center">{v.total}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">{v.aceitas}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{v.pendentes}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatBRL(v.valor_aceito)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{v.taxa_conversao}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
