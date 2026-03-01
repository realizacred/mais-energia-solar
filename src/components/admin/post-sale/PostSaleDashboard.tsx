import { CalendarClock, AlertTriangle, CheckCircle2, Shield, FileText, TrendingUp } from "lucide-react";
import { usePostSaleDashboard, usePostSaleVisits } from "@/hooks/usePostSale";
import { StatCard } from "@/components/ui-kit/StatCard";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const VISIT_STATUS_COLORS: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  agendado: "bg-info/10 text-info border-info/30",
  concluido: "bg-success/10 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export function PostSaleDashboard() {
  const { data: stats, isLoading: loadingStats } = usePostSaleDashboard();
  const { data: visits = [], isLoading: loadingVisits } = usePostSaleVisits();

  const today = new Date();
  const upcomingVisits = visits
    .filter(v => v.status !== "concluido" && v.status !== "cancelado" && v.data_prevista)
    .sort((a, b) => new Date(a.data_prevista!).getTime() - new Date(b.data_prevista!).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={CalendarClock} label="Próximas 30 dias" value={stats?.preventivas_proximas_30d ?? 0} color="info" />
        <StatCard icon={AlertTriangle} label="Atrasadas" value={stats?.preventivas_atrasadas ?? 0} color="destructive" />
        <StatCard icon={CheckCircle2} label="Concluídas (mês)" value={stats?.preventivas_concluidas_mes ?? 0} color="success" />
        <StatCard icon={Shield} label="Garantias vencendo" value={stats?.garantias_vencendo_3m ?? 0} color="warning" />
        <StatCard icon={FileText} label="Planos ativos" value={stats?.total_planos_ativos ?? 0} color="primary" />
        <StatCard icon={TrendingUp} label="Upsells pendentes" value={stats?.total_upsell_pendentes ?? 0} color="secondary" />
      </div>

      {/* Upcoming visits */}
      <SectionCard title="Próximas visitas" description="Preventivas e serviços agendados">
        {upcomingVisits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma visita pendente</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">CLIENTE</TableHead>
                <TableHead className="text-xs">PROJETO</TableHead>
                <TableHead className="text-xs">TIPO</TableHead>
                <TableHead className="text-xs">DATA PREVISTA</TableHead>
                <TableHead className="text-xs">STATUS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingVisits.map(v => {
                const isLate = v.data_prevista && isPast(new Date(v.data_prevista));
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm font-medium">{v.cliente?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.projeto?.codigo ?? v.projeto?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{v.tipo}</Badge></TableCell>
                    <TableCell className={`text-sm ${isLate ? "text-destructive font-medium" : ""}`}>
                      {v.data_prevista ? format(new Date(v.data_prevista), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      {isLate && " ⚠️"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${VISIT_STATUS_COLORS[v.status] ?? ""}`}>
                        {v.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

export default PostSaleDashboard;
