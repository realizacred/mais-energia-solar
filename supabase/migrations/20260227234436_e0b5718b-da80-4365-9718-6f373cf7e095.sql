
-- ═══════════════════════════════════════════════════════════
-- MODULE: POST-SALE (Pós-Venda Solar)
-- Tables, RLS, Indexes, Triggers
-- ═══════════════════════════════════════════════════════════

-- A) post_sale_plans
CREATE TABLE IF NOT EXISTS public.post_sale_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','closed')),
  data_inicio DATE,
  proxima_preventiva DATE,
  periodicidade_meses INTEGER NOT NULL DEFAULT 12,
  garantia_inversor_fim DATE,
  garantia_modulos_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_post_sale_plan_tenant_projeto UNIQUE (tenant_id, projeto_id)
);

ALTER TABLE public.post_sale_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_sale_plans_select" ON public.post_sale_plans FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_plans_insert" ON public.post_sale_plans FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_plans_update" ON public.post_sale_plans FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_plans_delete" ON public.post_sale_plans FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_post_sale_plans_updated_at BEFORE UPDATE ON public.post_sale_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B) post_sale_visits
CREATE TABLE IF NOT EXISTS public.post_sale_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  plan_id UUID REFERENCES public.post_sale_plans(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  tipo TEXT NOT NULL DEFAULT 'preventiva' CHECK (tipo IN ('preventiva','limpeza','suporte','vistoria','corretiva')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','agendado','concluido','cancelado')),
  data_prevista DATE,
  data_agendada TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  tecnico_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_sale_visits_select" ON public.post_sale_visits FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_visits_insert" ON public.post_sale_visits FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_visits_update" ON public.post_sale_visits FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "post_sale_visits_delete" ON public.post_sale_visits FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_post_sale_visits_tenant_status ON public.post_sale_visits(tenant_id, status);
CREATE INDEX idx_post_sale_visits_tenant_data ON public.post_sale_visits(tenant_id, data_prevista);

CREATE TRIGGER update_post_sale_visits_updated_at BEFORE UPDATE ON public.post_sale_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- C) post_sale_checklist_templates
CREATE TABLE IF NOT EXISTS public.post_sale_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'preventiva',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_checklist_tpl_select" ON public.post_sale_checklist_templates FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_tpl_insert" ON public.post_sale_checklist_templates FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_tpl_update" ON public.post_sale_checklist_templates FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_tpl_delete" ON public.post_sale_checklist_templates FOR DELETE USING (tenant_id = get_user_tenant_id());

-- D) post_sale_checklist_items
CREATE TABLE IF NOT EXISTS public.post_sale_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  template_id UUID NOT NULL REFERENCES public.post_sale_checklist_templates(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_checklist_items_select" ON public.post_sale_checklist_items FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_items_insert" ON public.post_sale_checklist_items FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_items_update" ON public.post_sale_checklist_items FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_checklist_items_delete" ON public.post_sale_checklist_items FOR DELETE USING (tenant_id = get_user_tenant_id());

-- E) post_sale_visit_checklist
CREATE TABLE IF NOT EXISTS public.post_sale_visit_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  visit_id UUID NOT NULL REFERENCES public.post_sale_visits(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.post_sale_checklist_items(id),
  status TEXT NOT NULL DEFAULT 'na' CHECK (status IN ('ok','atencao','problema','na')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_visit_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_visit_checklist_select" ON public.post_sale_visit_checklist FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_visit_checklist_insert" ON public.post_sale_visit_checklist FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_visit_checklist_update" ON public.post_sale_visit_checklist FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_visit_checklist_delete" ON public.post_sale_visit_checklist FOR DELETE USING (tenant_id = get_user_tenant_id());

-- F) post_sale_attachments
CREATE TABLE IF NOT EXISTS public.post_sale_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  visit_id UUID NOT NULL REFERENCES public.post_sale_visits(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_attachments_select" ON public.post_sale_attachments FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_attachments_insert" ON public.post_sale_attachments FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_attachments_delete" ON public.post_sale_attachments FOR DELETE USING (tenant_id = get_user_tenant_id());

-- G) post_sale_upsell_opportunities
CREATE TABLE IF NOT EXISTS public.post_sale_upsell_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) DEFAULT (get_user_tenant_id()),
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  tipo TEXT NOT NULL DEFAULT 'expansao' CHECK (tipo IN ('bateria','expansao','carregador_ev','troca_inversor')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','contatado','vendido','perdido')),
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_sale_upsell_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_upsell_select" ON public.post_sale_upsell_opportunities FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_upsell_insert" ON public.post_sale_upsell_opportunities FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_upsell_update" ON public.post_sale_upsell_opportunities FOR UPDATE USING (tenant_id = get_user_tenant_id());
CREATE POLICY "ps_upsell_delete" ON public.post_sale_upsell_opportunities FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE TRIGGER update_ps_upsell_updated_at BEFORE UPDATE ON public.post_sale_upsell_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- TRIGGER: Auto-create plan + visit when project is installed
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_create_post_sale_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id UUID;
  _proxima DATE;
BEGIN
  -- Only fire when status becomes 'instalado' and data_instalacao is set
  IF NEW.status = 'instalado' AND NEW.data_instalacao IS NOT NULL THEN
    -- Check if plan already exists
    SELECT id INTO _plan_id FROM post_sale_plans
      WHERE tenant_id = NEW.tenant_id AND projeto_id = NEW.id;
    
    IF _plan_id IS NULL THEN
      _proxima := (NEW.data_instalacao::date + INTERVAL '12 months')::date;
      
      INSERT INTO post_sale_plans (tenant_id, projeto_id, cliente_id, data_inicio, proxima_preventiva)
      VALUES (NEW.tenant_id, NEW.id, NEW.cliente_id, NEW.data_instalacao::date, _proxima)
      RETURNING id INTO _plan_id;
      
      INSERT INTO post_sale_visits (tenant_id, plan_id, projeto_id, cliente_id, tipo, status, data_prevista)
      VALUES (NEW.tenant_id, _plan_id, NEW.id, NEW.cliente_id, 'preventiva', 'pendente', _proxima);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_post_sale_plan
  AFTER INSERT OR UPDATE OF status ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_post_sale_plan();

-- ═══════════════════════════════════════════════════════════
-- TRIGGER: Auto-schedule next preventive when visit is completed
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_schedule_next_preventive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan RECORD;
  _next_date DATE;
BEGIN
  -- Only when status changes to 'concluido' and it's a preventiva
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' AND NEW.tipo = 'preventiva' AND NEW.plan_id IS NOT NULL THEN
    SELECT * INTO _plan FROM post_sale_plans WHERE id = NEW.plan_id;
    
    IF _plan.id IS NOT NULL AND _plan.status = 'active' THEN
      _next_date := (COALESCE(_plan.proxima_preventiva, CURRENT_DATE) + (_plan.periodicidade_meses || ' months')::interval)::date;
      
      -- Update plan
      UPDATE post_sale_plans SET proxima_preventiva = _next_date WHERE id = _plan.id;
      
      -- Create next visit
      INSERT INTO post_sale_visits (tenant_id, plan_id, projeto_id, cliente_id, tipo, status, data_prevista)
      VALUES (_plan.tenant_id, _plan.id, _plan.projeto_id, _plan.cliente_id, 'preventiva', 'pendente', _next_date);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_next_preventive
  AFTER UPDATE OF status ON public.post_sale_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_schedule_next_preventive();
