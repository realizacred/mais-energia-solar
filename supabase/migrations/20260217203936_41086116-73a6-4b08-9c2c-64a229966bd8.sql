
-- Notas do projeto (histórico imutável de anotações)
CREATE TABLE public.deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id)
);

ALTER TABLE public.deal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_deal_notes" ON public.deal_notes
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_deal_notes_deal_id ON public.deal_notes(deal_id);
CREATE INDEX idx_deal_notes_tenant ON public.deal_notes(tenant_id);

-- Atividades do projeto (tarefas agendáveis)
CREATE TYPE public.deal_activity_type AS ENUM ('call', 'meeting', 'email', 'task', 'visit', 'follow_up', 'other');
CREATE TYPE public.deal_activity_status AS ENUM ('pending', 'done', 'cancelled');

CREATE TABLE public.deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  activity_type public.deal_activity_type NOT NULL DEFAULT 'task',
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status public.deal_activity_status NOT NULL DEFAULT 'pending',
  assigned_to UUID,
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id)
);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_deal_activities" ON public.deal_activities
  FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_deal_activities_deal_id ON public.deal_activities(deal_id);
CREATE INDEX idx_deal_activities_tenant ON public.deal_activities(tenant_id);
CREATE INDEX idx_deal_activities_due ON public.deal_activities(due_date) WHERE status = 'pending';

-- Trigger updated_at
CREATE TRIGGER update_deal_activities_updated_at
  BEFORE UPDATE ON public.deal_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
