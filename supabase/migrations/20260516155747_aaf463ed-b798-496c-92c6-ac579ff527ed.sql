-- Phase 1: Projection Tables
CREATE TABLE public.project_operational_projection (
  project_id UUID PRIMARY KEY REFERENCES public.projetos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  codigo TEXT,
  cliente_nome TEXT,
  status_operacional TEXT,
  etapa_operacional TEXT,
  data_venda DATE,
  data_previsao_instalacao DATE,
  data_instalacao DATE,
  potencia_kwp NUMERIC,
  is_delayed BOOLEAN DEFAULT false,
  sla_status TEXT,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.deal_financial_projection (
  deal_id UUID PRIMARY KEY REFERENCES public.deals(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  title TEXT,
  total_value NUMERIC DEFAULT 0,
  contract_value NUMERIC DEFAULT 0,
  received_value NUMERIC DEFAULT 0,
  pending_value NUMERIC DEFAULT 0,
  margin_percentage NUMERIC,
  commission_value NUMERIC DEFAULT 0,
  is_overdue BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.wa_conversation_projection (
  conversation_id UUID PRIMARY KEY REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  last_message_text TEXT,
  unread_count INT DEFAULT 0,
  last_customer_message_at TIMESTAMP WITH TIME ZONE,
  last_agent_message_at TIMESTAMP WITH TIME ZONE,
  sla_status TEXT,
  is_waiting_response BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 2: Feature Flags
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled_globally BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.tenant_feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  feature_flag_id UUID REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, feature_flag_id)
);

-- Phase 3: Job Queue
CREATE TABLE public.enterprise_job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  heartbeat_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 6: Timeline Unified
CREATE TABLE public.project_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  project_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Enablement
ALTER TABLE public.project_operational_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_financial_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversation_projection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;

-- Generic RLS Policies
CREATE POLICY "Tenant read operational projection" ON public.project_operational_projection FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant read financial projection" ON public.deal_financial_projection FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant read conversation projection" ON public.wa_conversation_projection FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Public read feature flags" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Tenant read feature flags" ON public.tenant_feature_flags FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant read job queue" ON public.enterprise_job_queue FOR SELECT USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant read timeline events" ON public.project_timeline_events FOR SELECT USING (tenant_id = get_user_tenant_id());

-- Update Triggers Functions
CREATE OR REPLACE FUNCTION public.refresh_project_operational_projection()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.project_operational_projection (
        project_id, tenant_id, codigo, status_operacional, data_venda, potencia_kwp
    )
    VALUES (
        NEW.id, NEW.tenant_id, NEW.codigo, NEW.status::text, NEW.data_venda, NEW.potencia_kwp
    )
    ON CONFLICT (project_id) DO UPDATE SET
        status_operacional = EXCLUDED.status_operacional,
        codigo = EXCLUDED.codigo,
        data_venda = EXCLUDED.data_venda,
        potencia_kwp = EXCLUDED.potencia_kwp,
        last_updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_refresh_project_operational
AFTER INSERT OR UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.refresh_project_operational_projection();

CREATE OR REPLACE FUNCTION public.refresh_deal_financial_projection()
RETURNS TRIGGER AS $$
DECLARE
    v_received_value NUMERIC;
BEGIN
    SELECT COALESCE(SUM(valor), 0) INTO v_received_value 
    FROM public.lancamentos_financeiros 
    WHERE projeto_id = NEW.projeto_id AND status = 'pago';

    INSERT INTO public.deal_financial_projection (
        deal_id, tenant_id, projeto_id, title, total_value, received_value, pending_value
    )
    VALUES (
        NEW.id, NEW.tenant_id, NEW.projeto_id, NEW.title, NEW.value, v_received_value, (NEW.value - v_received_value)
    )
    ON CONFLICT (deal_id) DO UPDATE SET
        total_value = EXCLUDED.total_value,
        received_value = EXCLUDED.received_value,
        pending_value = EXCLUDED.pending_value,
        title = EXCLUDED.title,
        last_updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_refresh_deal_financial
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.refresh_deal_financial_projection();

-- Feature flag check function
CREATE OR REPLACE FUNCTION public.check_feature_flag(p_feature_name TEXT, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_enabled BOOLEAN;
    v_globally BOOLEAN;
    v_rollout INT;
BEGIN
    SELECT is_enabled_globally, rollout_percentage INTO v_globally, v_rollout 
    FROM public.feature_flags WHERE name = p_feature_name;
    
    IF v_globally THEN RETURN TRUE; END IF;
    
    -- Check tenant override
    SELECT is_enabled INTO v_enabled 
    FROM public.tenant_feature_flags 
    WHERE tenant_id = p_tenant_id 
    AND feature_flag_id = (SELECT id FROM public.feature_flags WHERE name = p_feature_name);
    
    IF v_enabled IS NOT NULL THEN RETURN v_enabled; END IF;
    
    -- Rollout logic based on tenant UUID hash
    IF v_rollout > 0 AND (('x' || substr(md5(p_tenant_id::text), 1, 8))::bit(32)::int % 100) < v_rollout THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
