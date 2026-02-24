import { useState } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardCheck,
  Timer,
  AlertTriangle,
  TrendingUp,
  Plus,
  RefreshCw,
  // Loader2 removed – using Spinner
  Trash2,
  CheckCircle2,
  Clock,
  Play,
  XCircle,
  Shield,
  Settings,
  BarChart3,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTasks, useSlaRules, type CreateTaskInput, type TaskStatus, type TaskPriority, type SlaRule } from "@/hooks/useTasks";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const priorityConfig: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  P0: { label: "P0 Urgente", color: "bg-destructive text-destructive-foreground", icon: AlertTriangle },
  P1: { label: "P1 Alto", color: "bg-warning text-warning-foreground", icon: Clock },
  P2: { label: "P2 Normal", color: "bg-info text-info-foreground", icon: Timer },
};

const statusConfig: Record<string, { label: string; icon: typeof Play }> = {
  open: { label: "Aberta", icon: Clock },
  doing: { label: "Em Andamento", icon: Play },
  done: { label: "Concluída", icon: CheckCircle2 },
  cancelled: { label: "Cancelada", icon: XCircle },
};

export function TasksSlaDashboard() {
  const [activeTab, setActiveTab] = useState("tasks");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-info/20 to-info/5 border border-info/10">
          <ClipboardCheck className="h-6 w-6 text-info" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Tarefas & SLA</h2>
          <p className="text-sm text-muted-foreground">Gestão operacional com prazos e escalonamento</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl grid grid-cols-3 gap-1">
          <TabsTrigger value="tasks" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">Tarefas</span>
          </TabsTrigger>
          <TabsTrigger value="sla" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 text-info" />
            <span className="hidden sm:inline">Dashboard SLA</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2 rounded-lg text-xs sm:text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4 text-secondary" />
            <span className="hidden sm:inline">Regras SLA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TasksManager />
        </TabsContent>
        <TabsContent value="sla" className="mt-4">
          <SlaDashboard />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <SlaRulesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tasks Manager ─────────────────────────────────────
function TasksManager() {
  const { tasks, loading, createTask, updateTaskStatus, deleteTask, isCreating } = useTasks();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Fetch vendedores for assignment
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-list"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("consultores").select("id, nome, user_id").eq("ativo", true);
      return data || [];
    },
  });

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
            const vendedor = vendedores?.find((v) => v.user_id === task.assigned_to);

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
                        {vendedor && <span>👤 {vendedor.nome}</span>}
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

// ── Create Task Dialog ────────────────────────────────
function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  vendedores,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateTaskInput) => void;
  isSubmitting: boolean;
  vendedores: { id: string; nome: string; user_id: string | null }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setTitle("");
    setDescription("");
    setPriority("P2");
    setAssignedTo("");
    setDueAt("");
  };

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => onOpenChange(true)}>
        <Plus className="h-4 w-4" />
        Nova Tarefa
      </Button>
      <FormModalTemplate
        open={open}
        onOpenChange={onOpenChange}
        title="Nova Tarefa"
        submitLabel="Criar Tarefa"
        onSubmit={handleSubmit}
        saving={isSubmitting}
        disabled={!title.trim()}
      >
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para cliente X" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <FormGrid>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - Urgente</SelectItem>
                    <SelectItem value="P1">P1 - Alto</SelectItem>
                    <SelectItem value="P2">P2 - Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            </FormGrid>
            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar consultor" /></SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.user_id || v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
      </FormModalTemplate>
    </>
  );
}

// ── SLA Dashboard ─────────────────────────────────────
function SlaDashboard() {
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
  });

  // SLA compliance per vendor
  const vendorStats = (vendedores || []).map((v) => {
    const vendorTasks = tasks.filter((t) => t.assigned_to === v.user_id);
    const vendorStats = computeSlaStats(vendorTasks);
    return { ...v, stats: vendorStats };
  }).filter((v) => v.stats.total > 0);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Tarefas Ativas</p>
          </CardContent>
        </Card>
        <Card className={stats.overdue > 0 ? "border-destructive/30" : ""}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${stats.overdue > 0 ? "text-destructive" : "text-foreground"}`}>
              {stats.overdue}
            </p>
            <p className="text-xs text-muted-foreground">Vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.slaComplianceRate}%</p>
            <p className="text-xs text-muted-foreground">Cumprimento SLA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {stats.avgCompletionMinutes > 0 ? `${Math.round(stats.avgCompletionMinutes / 60)}h` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Tempo Médio</p>
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
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Vencidas</TableHead>
                  <TableHead className="text-center">SLA %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorStats.sort((a, b) => b.stats.slaComplianceRate - a.stats.slaComplianceRate).map((v) => (
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
                const vendedor = vendedores?.find((v) => v.user_id === task.assigned_to);
                return (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-destructive/5 text-sm">
                    <Badge className={`${priorityConfig[task.priority]?.color} text-[10px]`}>{task.priority}</Badge>
                    <span className="flex-1 truncate">{task.title}</span>
                    {vendedor && <span className="text-xs text-muted-foreground">{vendedor.nome}</span>}
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

// ── SLA Rules Manager ─────────────────────────────────
function SlaRulesManager() {
  const { rules, loading, upsertRule, deleteRule } = useSlaRules();
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<Partial<SlaRule> | null>(null);

  // Lead statuses
  const { data: statuses } = useQuery({
    queryKey: ["lead-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("lead_status").select("id, nome, ordem").order("ordem");
      return data || [];
    },
  });

  const handleSave = async () => {
    if (!editRule?.rule_name) return;
    await upsertRule(editRule as any);
    setEditRule(null);
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Regras de SLA</h3>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditRule({
              rule_name: "",
              max_minutes_to_first_contact: 60,
              max_minutes_to_next_followup: 1440,
              escalation_enabled: true,
              auto_create_task: true,
              task_priority: "P1",
              ativo: true,
            });
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </CardContent></Card>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="empty-state">
            <div className="empty-state-icon"><Settings className="h-6 w-6 text-muted-foreground" /></div>
            <p className="empty-state-title">Nenhuma regra SLA</p>
            <p className="empty-state-description">Configure regras para criação automática de tarefas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const status = statuses?.find((s) => s.id === rule.applies_to);
            return (
              <Card key={rule.id} className="hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold">{rule.rule_name}</p>
                        <Badge variant={rule.ativo ? "default" : "secondary"} className="text-[10px]">
                          {rule.ativo ? "Ativa" : "Inativa"}
                        </Badge>
                        {rule.escalation_enabled && <Badge variant="outline" className="text-[10px]">Escalonamento</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        {status && <span>Status: {status.nome}</span>}
                        <span>1º contato: {rule.max_minutes_to_first_contact}min</span>
                        <span>Follow-up: {Math.round(rule.max_minutes_to_next_followup / 60)}h</span>
                        <span>Prioridade: {rule.task_priority}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditRule(rule); setShowCreate(true); }}>Editar</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteRule(rule.id)}>
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

      {/* Edit/Create Dialog */}
      <FormModalTemplate
        open={showCreate}
        onOpenChange={(v) => { if (!v) { setEditRule(null); } setShowCreate(v); }}
        title={editRule?.id ? "Editar Regra SLA" : "Nova Regra SLA"}
        submitLabel="Salvar"
        onSubmit={handleSave}
        disabled={!editRule?.rule_name}
      >
          {editRule && (
            <>
              <div className="space-y-2">
                <Label>Nome da Regra *</Label>
                <Input value={editRule.rule_name || ""} onChange={(e) => setEditRule({ ...editRule, rule_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Aplicar quando lead entrar no status</Label>
                <Select value={editRule.applies_to || ""} onValueChange={(v) => setEditRule({ ...editRule, applies_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                  <SelectContent>
                    {(statuses || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FormGrid>
                <div className="space-y-2">
                  <Label>1º Contato (min)</Label>
                  <Input type="number" value={editRule.max_minutes_to_first_contact || 60} onChange={(e) => setEditRule({ ...editRule, max_minutes_to_first_contact: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Follow-up (min)</Label>
                  <Input type="number" value={editRule.max_minutes_to_next_followup || 1440} onChange={(e) => setEditRule({ ...editRule, max_minutes_to_next_followup: Number(e.target.value) })} />
                </div>
              </FormGrid>
              <div className="space-y-2">
                <Label>Prioridade da Tarefa</Label>
                <Select value={editRule.task_priority || "P1"} onValueChange={(v) => setEditRule({ ...editRule, task_priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - Urgente</SelectItem>
                    <SelectItem value="P1">P1 - Alto</SelectItem>
                    <SelectItem value="P2">P2 - Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.auto_create_task ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, auto_create_task: v })} />
                  <Label>Criar tarefa automaticamente</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.escalation_enabled ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, escalation_enabled: v })} />
                  <Label>Habilitar escalonamento</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editRule.ativo ?? true} onCheckedChange={(v) => setEditRule({ ...editRule, ativo: v })} />
                  <Label>Regra ativa</Label>
                </div>
              </div>
            </>
          )}
      </FormModalTemplate>
    </div>
  );
}
