import { useState } from "react";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardCheck,
  Trash2,
  CheckCircle2,
  Play,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasks } from "@/hooks/useTasks";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { priorityConfig } from "./taskConstants";
import { CreateTaskDialog } from "./CreateTaskDialog";

export function TasksManager() {
  const { tasks, loading, createTask, updateTaskStatus, deleteTask, isCreating } = useTasks();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Fetch vendedores for assignment
  const { data: vendedores } = useConsultoresAtivos();

  const filtered = tasks.filter((t) => {
    if (filterStatus === "active" && (t.status === "done" || t.status === "cancelled")) return false;
    if (filterStatus === "done" && t.status !== "done") return false;
    if (filterStatus === "cancelled" && t.status !== "cancelled") return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="P0">P0</SelectItem>
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CreateTaskDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSubmit={async (input) => {
            await createTask(input);
            setShowCreate(false);
          }}
          isSubmitting={isCreating}
          vendedores={vendedores || []}
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="empty-state">
            <div className="empty-state-icon"><ClipboardCheck className="h-6 w-6 text-muted-foreground" /></div>
            <p className="empty-state-title">Nenhuma tarefa encontrada</p>
            <p className="empty-state-description">Crie uma tarefa ou ajuste os filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const isOverdue = task.due_at && isPast(new Date(task.due_at)) && task.status !== "done" && task.status !== "cancelled";
            const prio = priorityConfig[task.priority] || priorityConfig.P2;
            const vendedor = vendedores?.find((v: any) => v.user_id === task.assigned_to);

            return (
              <Card key={task.id} className={`transition-all duration-200 hover:-translate-y-0.5 ${isOverdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Status toggle */}
                    <button
                      onClick={() => {
                        if (task.status === "open") updateTaskStatus({ taskId: task.id, status: "doing" });
                        else if (task.status === "doing") updateTaskStatus({ taskId: task.id, status: "done" });
                      }}
                      className="mt-0.5 shrink-0"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : task.status === "doing" ? (
                        <Play className="h-5 w-5 text-info" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={`${prio.color} text-[10px]`}>{task.priority}</Badge>
                        {task.source === "sla" && <Badge variant="outline" className="text-[10px]">SLA</Badge>}
                        {task.source === "ai" && <Badge variant="outline" className="text-[10px]">IA</Badge>}
                        {isOverdue && <Badge variant="destructive" className="text-[10px]">Vencida</Badge>}
                      </div>
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {vendedor && <span>👤 {(vendedor as any).nome}</span>}
                        {task.due_at && (
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>
                            ⏰ {formatDistanceToNow(new Date(task.due_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                        {task.related_type && <span>📎 {task.related_type}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {task.status !== "done" && task.status !== "cancelled" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateTaskStatus({ taskId: task.id, status: "done" })}>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTask(task.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
