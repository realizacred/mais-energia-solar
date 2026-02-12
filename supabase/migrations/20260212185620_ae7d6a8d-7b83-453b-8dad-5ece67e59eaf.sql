
-- Temporarily disable audit_logs immutability triggers
ALTER TABLE public.audit_logs DISABLE TRIGGER prevent_audit_update;
ALTER TABLE public.audit_logs DISABLE TRIGGER prevent_audit_log_update;

UPDATE audit_logs 
SET tenant_id = (SELECT id FROM tenants WHERE ativo = true LIMIT 1)
WHERE tenant_id IS NULL;

ALTER TABLE public.audit_logs ENABLE TRIGGER prevent_audit_update;
ALTER TABLE public.audit_logs ENABLE TRIGGER prevent_audit_log_update;

-- NOT NULL on audit_logs
ALTER TABLE public.audit_logs ALTER COLUMN tenant_id SET NOT NULL;

-- Remaining config/reference tables
ALTER TABLE public.baterias ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.concessionarias ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.disjuntores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.inversores ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.modulos_fotovoltaicos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fio_b_escalonamento ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.financiamento_bancos ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.financiamento_api_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.layouts_solares ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instagram_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instagram_posts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instalador_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instalador_metas ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.instalador_performance_mensal ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.meta_notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payback_config ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.ai_insights ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.proposal_variables ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.release_checklists ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.site_servicos ALTER COLUMN tenant_id SET NOT NULL;

-- Dead Letter Queue
CREATE TABLE public.dead_letter_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  error_message text,
  error_details jsonb DEFAULT '{}'::jsonb,
  payload jsonb DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'retrying', 'resolved', 'ignored')),
  failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dlq_tenant_status ON dead_letter_queue(tenant_id, status);
CREATE INDEX idx_dlq_source ON dead_letter_queue(source_table, source_id);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_dlq_select_admin" ON public.dead_letter_queue
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE POLICY "rls_dlq_update_admin" ON public.dead_letter_queue
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "rls_dlq_service" ON public.dead_letter_queue
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (tenant_id IS NOT NULL);

CREATE TRIGGER update_dlq_updated_at
  BEFORE UPDATE ON public.dead_letter_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.dead_letter_queue IS 'Dead Letter Queue para operações falhadas que excederam retries. Diagnóstico e reprocessamento por admins.';
