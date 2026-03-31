import { TrendingUp, Users, AlertTriangle, ShieldAlert, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCommercialDashboard, type TenantUsageRow } from "@/hooks/useCommercialDashboard";

const METRIC_LABELS: Record<string, string> = {
  max_ai_insights_month: "Insights IA / mês",
  max_reports_pdf_month: "Relatórios PDF / mês",
  max_automations: "Automações",
  max_performance_alerts: "Alertas Performance / mês",
  max_leads_month: "Leads / mês",
  max_wa_messages_month: "Mensagens WA / mês",
  max_proposals_month: "Propostas / mês",
  max_users: "Usuários",
};

function StatCard({ icon: Icon, label, value, borderColor }: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  borderColor: string;
}) {
  return (
    <Card className={`border-l-[3px] ${borderColor} bg-card shadow-sm hover:shadow-md transition-shadow`}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${borderColor.replace("border-l-", "bg-")}/10 ${borderColor.replace("border-l-", "text-")} shrink-0`}>
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

function StatusBadge({ status }: { status: TenantUsageRow["status"] }) {
  if (status === "blocked") {
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Bloqueado</Badge>;
  }
  if (status === "warning") {
    return <Badge className="bg-warning/10 text-warning border-warning/20">Próximo</Badge>;
  }
  return <Badge variant="outline">Normal</Badge>;
}

export default function CommercialDashboardPage() {
  const { data, isLoading } = useCommercialDashboard();

  const upsellRows = data?.rows.filter((r) => r.status === "warning" || r.status === "blocked") ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard Comercial</h1>
            <p className="text-sm text-muted-foreground">Uso, limites e oportunidades de upgrade</p>
          </div>
        </div>
      </div>

      {/* KPI Cards §27 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Tenants ativos" value={data?.totalActiveTenants ?? 0} borderColor="border-l-primary" />
          <StatCard icon={AlertTriangle} label="Próximos do limite (>80%)" value={data?.tenantsNearLimit ?? 0} borderColor="border-l-warning" />
          <StatCard icon={ShieldAlert} label="Bloqueados (100%)" value={data?.tenantsBlocked ?? 0} borderColor="border-l-destructive" />
          <StatCard icon={Activity} label="Eventos de uso (mês)" value={data?.totalEventsMonth ?? 0} borderColor="border-l-primary" />
        </div>
      )}

      {/* Upsell Section */}
      {upsellRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-warning" />
              Clientes para upgrade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upsellRows.slice(0, 10).map((row, i) => (
                <div key={`${row.tenant_id}-${row.metric_key}-${i}`} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.tenant_nome}</p>
                    <p className="text-xs text-muted-foreground">{METRIC_LABELS[row.metric_key] ?? row.metric_key}</p>
                  </div>
                  <div className="w-32 shrink-0">
                    <Progress
                      value={Math.min(row.percentage, 100)}
                      className={`h-2 ${row.status === "blocked" ? "[&>div]:bg-destructive" : "[&>div]:bg-warning"}`}
                    />
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <span className={`text-sm font-mono font-medium ${row.status === "blocked" ? "text-destructive" : "text-warning"}`}>
                      {row.current_value}/{row.limit_value}
                    </span>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Table §4 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Uso por Tenant</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !data?.rows.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Nenhum dado de uso encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">O uso será exibido conforme os tenants utilizarem o sistema</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Tenant</TableHead>
                    <TableHead className="font-semibold text-foreground">Plano</TableHead>
                    <TableHead className="font-semibold text-foreground">Recurso</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Uso</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Limite</TableHead>
                    <TableHead className="font-semibold text-foreground w-[140px]">Progresso</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row, i) => (
                    <TableRow key={`${row.tenant_id}-${row.metric_key}-${i}`} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{row.tenant_nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.plan_code ?? "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{METRIC_LABELS[row.metric_key] ?? row.metric_key}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.current_value}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{row.limit_value}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(row.percentage, 100)}
                            className={`h-2 flex-1 ${row.status === "blocked" ? "[&>div]:bg-destructive" : row.status === "warning" ? "[&>div]:bg-warning" : ""}`}
                          />
                          <span className="text-xs text-muted-foreground w-10 text-right">{row.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
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
