
-- ====================================================
-- TASKS TABLE
-- ====================================================
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  assigned_to uuid,
  related_type text, -- lead | orcamento | projeto | servico
  related_id uuid,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'P2', -- P0 | P1 | P2
  due_at timestamp with time zone,
  status text NOT NULL DEFAULT 'open', -- open | doing | done | cancelled
  completed_at timestamp with time zone,
  source text DEFAULT 'manual', -- manual | sla | ai
  sla_rule_id uuid
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tasks"
ON public.tasks FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users read assigned tasks"
ON public.tasks FOR SELECT
USING (assigned_to = auth.uid());

CREATE POLICY "Users update assigned tasks"
ON public.tasks FOR UPDATE
USING (assigned_to = auth.uid());

CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to, status);
CREATE INDEX idx_tasks_due ON public.tasks(due_at) WHERE status IN ('open', 'doing');
CREATE INDEX idx_tasks_related ON public.tasks(related_type, related_id);

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.tasks IS 'Tarefas operacionais com SLA para vendedores e equipe';

-- ====================================================
-- TASK EVENTS TABLE (audit trail for tasks)
-- ====================================================
CREATE TABLE public.task_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL, -- created | assigned | status_changed | comment | escalated
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage task_events"
ON public.task_events FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users read own task events"
ON public.task_events FOR SELECT
USING (user_id = auth.uid() OR task_id IN (SELECT id FROM public.tasks WHERE assigned_to = auth.uid()));

CREATE INDEX idx_task_events_task ON public.task_events(task_id, created_at DESC);

COMMENT ON TABLE public.task_events IS 'Histórico de ações em tarefas (audit trail)';

-- ====================================================
-- SLA RULES TABLE
-- ====================================================
CREATE TABLE public.sla_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  rule_name text NOT NULL,
  applies_to uuid, -- lead_status_id
  max_minutes_to_first_contact integer DEFAULT 60,
  max_minutes_to_next_followup integer DEFAULT 1440, -- 24h
  escalation_enabled boolean DEFAULT true,
  auto_create_task boolean DEFAULT true,
  task_priority text DEFAULT 'P1',
  ativo boolean DEFAULT true
);

ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sla_rules"
ON public.sla_rules FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated read sla_rules"
ON public.sla_rules FOR SELECT
USING (true);

CREATE TRIGGER update_sla_rules_updated_at
BEFORE UPDATE ON public.sla_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.sla_rules IS 'Regras de SLA para criação automática de tarefas e escalonamento';
