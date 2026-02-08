import { useState } from "react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Play,
  Phone,
  MessageCircle,
  AlertTriangle,
  Filter,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasks, type TaskStatus } from "@/hooks/useTasks";

const priorityConfig: Record<string, { label: string; color: string }> = {
  P0: { label: "Urgente", color: "bg-destructive text-destructive-foreground" },
  P1: { label: "Alto", color: "bg-warning text-warning-foreground" },
  P2: { label: "Normal", color: "bg-info text-info-foreground" },
};

export function VendorTaskAgenda() {
  const { tasks, loading, updateTaskStatus, computeSlaStats } = useTasks({ onlyMine: true, status: ["open", "doing"] });
  const [filterPriority, setFilterPriority] = useState("all");

  const stats = computeSlaStats(tasks);
  const now = new Date();

  const filtered = tasks
    .filter((t) => filterPriority === "all" || t.priority === filterPriority)
    .sort((a, b) => {
      // Sort by: overdue first, then by priority (P0>P1>P2), then by due_at
      const aOverdue = a.due_at && isPast(new Date(a.due_at)) ? 0 : 1;
      const bOverdue = b.due_at && isPast(new Date(b.due_at)) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;

      const prioOrder = { P0: 0, P1: 1, P2: 2 };
      const aPrio = prioOrder[a.priority as keyof typeof prioOrder] ?? 2;
      const bPrio = prioOrder[b.priority as keyof typeof prioOrder] ?? 2;
      if (aPrio !== bPrio) return aPrio - bPrio;

      if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      return 0;
    });

  // Group by date
  const groups: { label: string; tasks: typeof filtered }[] = [];
  const todayTasks = filtered.filter((t) => t.due_at && isToday(new Date(t.due_at)));
  const tomorrowTasks = filtered.filter((t) => t.due_at && isTomorrow(new Date(t.due_at)));
  const overdueTasks = filtered.filter(
    (t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))
  );
  const laterTasks = filtered.filter(
    (t) => !t.due_at || (!isToday(new Date(t.due_at)) && !isTomorrow(new Date(t.due_at)) && !isPast(new Date(t.due_at)))
  );

  if (overdueTasks.length > 0) groups.push({ label: "⚠️ Vencidas", tasks: overdueTasks });
  if (todayTasks.length > 0) groups.push({ label: "📌 Hoje", tasks: todayTasks });
  if (tomorrowTasks.length > 0) groups.push({ label: "📅 Amanhã", tasks: tomorrowTasks });
  if (laterTasks.length > 0) groups.push({ label: "📋 Próximas", tasks: laterTasks });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Minha Agenda</h3>
          <p className="text-xs text-muted-foreground">
            {stats.active} tarefas ativas · {stats.overdue} vencidas
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className={stats.overdue > 0 ? "border-destructive/30 bg-destructive/5" : ""}>
          <CardContent className="p-3 text-center">
            <p className={`text-xl font-bold ${stats.overdue > 0 ? "text-destructive" : "text-foreground"}`}>
              {stats.overdue}
            </p>
            <p className="text-[10px] text-muted-foreground">Vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{todayTasks.length}</p>
            <p className="text-[10px] text-muted-foreground">Hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-success">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="P0">P0 Urgente</SelectItem>
            <SelectItem value="P1">P1 Alto</SelectItem>
            <SelectItem value="P2">P2 Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task Groups */}
      {groups.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-success mb-3" />
            <p className="text-base font-semibold">Tudo em dia! 🎉</p>
            <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente.</p>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <div key={group.label}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{group.label}</h4>
            <div className="space-y-2">
              {group.tasks.map((task) => {
                const isOverdue = task.due_at && isPast(new Date(task.due_at));
                const prio = priorityConfig[task.priority] || priorityConfig.P2;

                return (
                  <Card
                    key={task.id}
                    className={`transition-all duration-200 ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Toggle */}
                        <button
                          onClick={() => {
                            if (task.status === "open") updateTaskStatus({ taskId: task.id, status: "doing" });
                            else updateTaskStatus({ taskId: task.id, status: "done" });
                          }}
                          className="mt-0.5 shrink-0"
                        >
                          {task.status === "doing" ? (
                            <Play className="h-5 w-5 text-info" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-success transition-colors" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge className={`${prio.color} text-[10px]`}>{task.priority}</Badge>
                            {task.source !== "manual" && (
                              <Badge variant="outline" className="text-[10px]">
                                {task.source === "sla" ? "SLA" : "IA"}
                              </Badge>
                            )}
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[10px]">Vencida</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          {task.due_at && (
                            <p className={`text-xs mt-1 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              ⏰ {formatDistanceToNow(new Date(task.due_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => updateTaskStatus({ taskId: task.id, status: "done" })}
                          >
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
