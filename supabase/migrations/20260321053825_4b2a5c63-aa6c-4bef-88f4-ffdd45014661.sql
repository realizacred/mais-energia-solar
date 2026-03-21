
-- ═══════════════════════════════════════
-- Feature 2: Lead Audit Log
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID NOT NULL,
  user_id UUID,
  user_nome TEXT,
  campo_alterado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_lead_audit_log_lead_id ON public.lead_audit_log(lead_id);
CREATE INDEX idx_lead_audit_log_tenant_id ON public.lead_audit_log(tenant_id);

ALTER TABLE public.lead_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for lead_audit_log"
ON public.lead_audit_log
FOR SELECT
TO authenticated
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Insert own tenant audit logs"
ON public.lead_audit_log
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = public.current_tenant_id());

-- Trigger function for lead changes
CREATE OR REPLACE FUNCTION public.trg_lead_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    INSERT INTO lead_audit_log(lead_id, tenant_id, campo_alterado, valor_anterior, valor_novo)
    VALUES(NEW.id, NEW.tenant_id, 'status_id', OLD.status_id::text, NEW.status_id::text);
  END IF;

  IF NEW.consultor IS DISTINCT FROM OLD.consultor THEN
    INSERT INTO lead_audit_log(lead_id, tenant_id, campo_alterado, valor_anterior, valor_novo)
    VALUES(NEW.id, NEW.tenant_id, 'consultor', OLD.consultor, NEW.consultor);
  END IF;

  IF NEW.ultimo_contato IS DISTINCT FROM OLD.ultimo_contato THEN
    INSERT INTO lead_audit_log(lead_id, tenant_id, campo_alterado, valor_anterior, valor_novo)
    VALUES(NEW.id, NEW.tenant_id, 'ultimo_contato', OLD.ultimo_contato::text, NEW.ultimo_contato::text);
  END IF;

  IF NEW.proxima_acao IS DISTINCT FROM OLD.proxima_acao THEN
    INSERT INTO lead_audit_log(lead_id, tenant_id, campo_alterado, valor_anterior, valor_novo)
    VALUES(NEW.id, NEW.tenant_id, 'proxima_acao', OLD.proxima_acao, NEW.proxima_acao);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_audit
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_lead_audit();

-- ═══════════════════════════════════════
-- Feature 5: Visitas Técnicas
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.visitas_tecnicas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  lead_id UUID REFERENCES public.leads(id),
  cliente_id UUID REFERENCES public.clientes(id),
  consultor_id UUID REFERENCES public.consultores(id),
  data_hora TIMESTAMPTZ NOT NULL,
  duracao_minutos INT DEFAULT 60,
  endereco TEXT,
  status TEXT DEFAULT 'agendada' NOT NULL,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_visitas_tecnicas_tenant ON public.visitas_tecnicas(tenant_id);
CREATE INDEX idx_visitas_tecnicas_data ON public.visitas_tecnicas(data_hora);

ALTER TABLE public.visitas_tecnicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for visitas_tecnicas"
ON public.visitas_tecnicas
FOR ALL
TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_visitas_tecnicas_updated_at
BEFORE UPDATE ON public.visitas_tecnicas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
