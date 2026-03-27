import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardCheck,
  Timer,
  AlertTriangle,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTasks } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { priorityConfig } from "./taskConstants";

export function SlaDashboard() {
  const { tasks, loading, computeSlaStats } = useTasks();
  const stats = computeSlaStats(tasks);

  // Group overdue by assignee
  const overdueTasks = tasks.filter(
    (t) => (t.status === "open" || t.status === "doing") && t.due_at && isPast(new Date(t.due_at))
  );

  // Fetch vendedores
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consultores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // SLA compliance per vendor
  const vendorStats = (vendedores || []).map((v: any) => {
    const vendorTasks = tasks.filter((t) => t.assigned_to === v.user_id);
    const vendorSlaStats = computeSlaStats(vendorTasks);
    return { ...v, stats: vendorSlaStats };
  }).filter((v: any) => v.stats.total > 0);

  if (loading) {
    return (
      <Card><CardContent className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{stats.active}</p>
              <p className="text-sm text-muted-foreground mt-1">Tarefas Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-[3px] bg-card shadow-sm hover:shadow-md transition-shadow ${stats.overdue > 0 ? "border-l-destructive" : "border-l-primary"}`}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stats.overdue > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-2xl font-bold tracking-tight leading-none ${stats.overdue > 0 ? "text-destructive" : "text-foreground"}`}>{stats.overdue}</p>
              <p className="text-sm text-muted-foreground mt-1">Vencidas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-success leading-none">{stats.slaComplianceRate}%</p>
              <p className="text-sm text-muted-foreground mt-1">Cumprimento SLA</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {stats.avgCompletionMinutes > 0 ? `${Math.round(stats.avgCompletionMinutes / 60)}h` : "—"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Tempo Médio</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-info" />
            Cumprimento de SLA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxa de cumprimento</span>
              <span className="font-semibold">{stats.slaComplianceRate}%</span>
            </div>
            <Progress value={stats.slaComplianceRate} className="h-3" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-2 rounded-lg bg-destructive/10">
              <p className="text-lg font-bold text-destructive">{stats.byPriority.P0}</p>
              <p className="text-[10px] text-muted-foreground">P0 Ativas</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-warning/10">
              <p className="text-lg font-bold text-warning">{stats.byPriority.P1}</p>
              <p className="text-[10px] text-muted-foreground">P1 Ativas</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-info/10">
              <p className="text-lg font-bold text-info">{stats.byPriority.P2}</p>
              <p className="text-[10px] text-muted-foreground">P2 Ativas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vendor SLA ranking */}
      {vendorStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">📊 Ranking por Cumprimento de SLA</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Vencidas</TableHead>
                  <TableHead className="text-center">SLA %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorStats.sort((a: any, b: any) => b.stats.slaComplianceRate - a.stats.slaComplianceRate).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-sm">{v.nome}</TableCell>
                    <TableCell className="text-center text-sm">{v.stats.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={v.stats.overdue > 0 ? "destructive" : "secondary"} className="text-xs">
                        {v.stats.overdue}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-semibold ${v.stats.slaComplianceRate >= 80 ? "text-success" : v.stats.slaComplianceRate >= 50 ? "text-warning" : "text-destructive"}`}>
                        {v.stats.slaComplianceRate}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tarefas Vencidas ({overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
              {overdueTasks.map((task) => {
                const vendedor = vendedores?.find((v: any) => v.user_id === task.assigned_to);
                return (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-destructive/5 text-sm">
                    <Badge className={`${priorityConfig[task.priority]?.color} text-[10px]`}>{task.priority}</Badge>
                    <span className="flex-1 truncate">{task.title}</span>
                    {vendedor && <span className="text-xs text-muted-foreground">{(vendedor as any).nome}</span>}
                    <span className="text-xs text-destructive">
                      {task.due_at && formatDistanceToNow(new Date(task.due_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
