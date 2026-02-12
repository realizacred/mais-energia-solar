
-- ============================================================
-- wa_ai_settings: per-tenant AI configuration
-- ============================================================
CREATE TABLE public.wa_ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  modo TEXT NOT NULL DEFAULT 'assistido' CHECK (modo IN ('assistido', 'automatico', 'desativado')),
  modelo_preferido TEXT DEFAULT 'gpt-4o-mini',
  max_sugestoes_dia INTEGER DEFAULT 100,
  templates JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

COMMENT ON TABLE public.wa_ai_settings IS 'Configurações de IA por tenant: modo (assistido/auto/desativado), modelo, limites e templates';

ALTER TABLE public.wa_ai_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage AI settings"
  ON public.wa_ai_settings FOR ALL
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id())
  WITH CHECK (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id());

-- Authenticated users can read their tenant's settings
CREATE POLICY "Users can read AI settings"
  ON public.wa_ai_settings FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_wa_ai_settings_updated_at
  BEFORE UPDATE ON public.wa_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- wa_ai_tasks: AI suggestions/tasks log
-- ============================================================
CREATE TABLE public.wa_ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('suggest_message', 'proposal_explainer', 'followup_planner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'accepted', 'rejected', 'expired')),
  suggestion TEXT,
  context JSONB DEFAULT '{}',
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wa_ai_tasks IS 'Registro de sugestões de IA (suggest, explainer, followup) com status e contexto. Cada task representa uma interação IA-vendedor.';

ALTER TABLE public.wa_ai_tasks ENABLE ROW LEVEL SECURITY;

-- Users can see tasks for their tenant conversations
CREATE POLICY "Users can view own tenant AI tasks"
  ON public.wa_ai_tasks FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Users can create tasks
CREATE POLICY "Users can create AI tasks"
  ON public.wa_ai_tasks FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Users can update tasks they requested
CREATE POLICY "Users can update own AI tasks"
  ON public.wa_ai_tasks FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND (requested_by = auth.uid() OR is_admin(auth.uid())));

-- Service role full access (for edge functions)
CREATE POLICY "Service role full access AI tasks"
  ON public.wa_ai_tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access AI settings"
  ON public.wa_ai_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER update_wa_ai_tasks_updated_at
  BEFORE UPDATE ON public.wa_ai_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_wa_ai_tasks_conversation ON public.wa_ai_tasks(conversation_id, created_at DESC);
CREATE INDEX idx_wa_ai_tasks_tenant_type ON public.wa_ai_tasks(tenant_id, type, status);
CREATE INDEX idx_wa_ai_tasks_requested_by ON public.wa_ai_tasks(requested_by, created_at DESC);
