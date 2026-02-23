import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────
export type TaskPriority = "P0" | "P1" | "P2";
export type TaskStatus = "open" | "doing" | "done" | "cancelled";
export type TaskSource = "manual" | "sla" | "ai";
export type RelatedType = "lead" | "orcamento" | "projeto" | "servico";

export interface Task {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  assigned_to: string | null;
  related_type: RelatedType | null;
  related_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string | null;
  status: TaskStatus;
  completed_at: string | null;
  source: TaskSource;
  sla_rule_id: string | null;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  payload: any;
  created_at: string;
}

export interface SlaRule {
  id: string;
  tenant_id: string;
  rule_name: string;
  applies_to: string | null;
  max_minutes_to_first_contact: number;
  max_minutes_to_next_followup: number;
  escalation_enabled: boolean;
  auto_create_task: boolean;
  task_priority: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  assigned_to?: string | null;
  related_type?: RelatedType | null;
  related_id?: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  source?: TaskSource;
  sla_rule_id?: string | null;
}

// ── Hook ──────────────────────────────────────────────
export function useTasks(filters?: {
  assigned_to?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  onlyMine?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch tasks
  const tasksQuery = useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("id, title, description, status, priority, assigned_to, created_by, due_at, completed_at, related_type, related_id, sla_rule_id, source, created_at, updated_at")
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: true })
        .order("created_at", { ascending: false });

      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      } else if (filters?.onlyMine && user) {
        query = query.eq("assigned_to", user.id);
      }

      if (filters?.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      if (filters?.priority && filters.priority.length > 0) {
        query = query.in("priority", filters.priority);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as Task[];
    },
    staleTime: 30 * 1000,
  });

  // ⚠️ HARDENING: Realtime subscription for cross-user sync on tasks
  useEffect(() => {
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Create task
  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Log event
      await supabase.from("task_events").insert({
        task_id: data.id,
        user_id: user?.id,
        action: "created",
        payload: { title: input.title, priority: input.priority || "P2" },
      });

      return data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa criada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Update task status
  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const updates: any = { status };
      if (status === "done") updates.completed_at = new Date().toISOString();
      if (status === "open" || status === "doing") updates.completed_at = null;

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;

      await supabase.from("task_events").insert({
        task_id: taskId,
        user_id: user?.id,
        action: "status_changed",
        payload: { new_status: status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Update task
  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Delete task
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Tarefa excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // SLA stats computation
  const computeSlaStats = (tasks: Task[]) => {
    const now = Date.now();
    const activeTasks = tasks.filter((t) => t.status === "open" || t.status === "doing");
    const overdue = activeTasks.filter((t) => t.due_at && new Date(t.due_at).getTime() < now);
    const completed = tasks.filter((t) => t.status === "done");

    const slaTasks = tasks.filter((t) => t.source === "sla");
    const slaCompleted = slaTasks.filter((t) => t.status === "done");
    const slaOverdue = slaTasks.filter(
      (t) => (t.status === "open" || t.status === "doing") && t.due_at && new Date(t.due_at).getTime() < now
    );

    const slaComplianceRate =
      slaTasks.length > 0
        ? Math.round(((slaCompleted.length) / (slaCompleted.length + slaOverdue.length || 1)) * 100)
        : 100;

    // Average completion time (minutes) for completed tasks
    let avgCompletionMinutes = 0;
    if (completed.length > 0) {
      const totalMinutes = completed.reduce((acc, t) => {
        if (t.completed_at && t.created_at) {
          return acc + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        }
        return acc;
      }, 0);
      avgCompletionMinutes = Math.round(totalMinutes / completed.length);
    }

    return {
      total: tasks.length,
      active: activeTasks.length,
      overdue: overdue.length,
      completed: completed.length,
      slaComplianceRate,
      avgCompletionMinutes,
      byPriority: {
        P0: activeTasks.filter((t) => t.priority === "P0").length,
        P1: activeTasks.filter((t) => t.priority === "P1").length,
        P2: activeTasks.filter((t) => t.priority === "P2").length,
      },
    };
  };

  return {
    tasks: tasksQuery.data || [],
    loading: tasksQuery.isLoading,
    refetch: tasksQuery.refetch,
    createTask: createTask.mutateAsync,
    updateTaskStatus: updateTaskStatus.mutate,
    updateTask: updateTask.mutate,
    deleteTask: deleteTask.mutate,
    isCreating: createTask.isPending,
    computeSlaStats,
  };
}

// ── SLA Rules Hook ───────────────────────────────────
export function useSlaRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["sla-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_rules")
        .select("id, rule_name, applies_to, max_minutes_to_first_contact, max_minutes_to_next_followup, auto_create_task, task_priority, escalation_enabled, ativo, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SlaRule[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: Partial<SlaRule> & { rule_name: string }) => {
      if (rule.id) {
        const { error } = await supabase
          .from("sla_rules")
          .update(rule)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sla_rules").insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
      toast({ title: "Regra SLA salva" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("sla_rules").delete().eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-rules"] });
      toast({ title: "Regra excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return {
    rules: rulesQuery.data || [],
    loading: rulesQuery.isLoading,
    upsertRule: upsertRule.mutateAsync,
    deleteRule: deleteRule.mutate,
  };
}

// ── Task Events Hook ─────────────────────────────────
export function useTaskEvents(taskId?: string) {
  return useQuery({
    queryKey: ["task-events", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from("task_events")
        .select("id, task_id, action, payload, user_id, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as TaskEvent[];
    },
    enabled: !!taskId,
    staleTime: 30 * 1000,
  });
}
