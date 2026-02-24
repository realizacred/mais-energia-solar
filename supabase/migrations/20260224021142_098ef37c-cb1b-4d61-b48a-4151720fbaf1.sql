
-- =============================================================
-- MÓDULO FISCAL NFS-e (Asaas) — Multi-tenant
-- =============================================================

-- ── fiscal_settings ──────────────────────────────────────────
CREATE TABLE public.fiscal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'asaas',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  portal_nacional_enabled BOOLEAN NOT NULL DEFAULT false,
  allow_deductions BOOLEAN NOT NULL DEFAULT false,
  auto_issue_on_payment BOOLEAN NOT NULL DEFAULT false,
  default_service_description TEXT,
  default_observations TEXT,
  default_effective_date_rule TEXT DEFAULT 'payment_date',
  default_taxes JSONB DEFAULT '{}',
  cnpj_emitente TEXT,
  inscricao_municipal TEXT,
  municipio_emitente TEXT,
  uf_emitente TEXT,
  regime_tributario TEXT,
  homologation_tested BOOLEAN NOT NULL DEFAULT false,
  homologation_tested_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);
ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_settings_tenant ON public.fiscal_settings(tenant_id);

CREATE POLICY "fiscal_settings_select" ON public.fiscal_settings FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_settings_insert" ON public.fiscal_settings FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_settings_update" ON public.fiscal_settings FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_settings_delete" ON public.fiscal_settings FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_municipal_requirements ────────────────────────────
CREATE TABLE public.fiscal_municipal_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  municipality_code TEXT,
  municipality_name TEXT,
  uf TEXT,
  required_fields JSONB NOT NULL DEFAULT '[]',
  raw_response JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_municipal_requirements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_mun_req_tenant ON public.fiscal_municipal_requirements(tenant_id);

CREATE POLICY "fiscal_mun_req_select" ON public.fiscal_municipal_requirements FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_req_insert" ON public.fiscal_municipal_requirements FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_req_update" ON public.fiscal_municipal_requirements FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_req_delete" ON public.fiscal_municipal_requirements FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_municipal_services ────────────────────────────────
CREATE TABLE public.fiscal_municipal_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asaas_service_id TEXT,
  service_code TEXT,
  service_name TEXT NOT NULL,
  description TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_municipal_services ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_mun_svc_tenant ON public.fiscal_municipal_services(tenant_id);

CREATE POLICY "fiscal_mun_svc_select" ON public.fiscal_municipal_services FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_svc_insert" ON public.fiscal_municipal_services FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_svc_update" ON public.fiscal_municipal_services FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_mun_svc_delete" ON public.fiscal_municipal_services FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_invoices ──────────────────────────────────────────
CREATE TABLE public.fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asaas_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validating','scheduled','synchronized','authorized','processing_cancellation','canceled','cancellation_denied','error')),
  status_asaas TEXT,
  
  -- Vínculo
  payment_id TEXT,
  installment_id TEXT,
  customer_id TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  recebimento_id UUID,
  
  -- Dados da nota
  service_description TEXT NOT NULL DEFAULT '',
  observations TEXT,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Serviço municipal
  municipal_service_id TEXT,
  municipal_service_code TEXT,
  municipal_service_name TEXT,
  
  -- Impostos
  taxes JSONB DEFAULT '{"retainIss":false,"iss":0,"cofins":0,"csll":0,"inss":0,"ir":0,"pis":0}',
  
  -- Resultado
  pdf_url TEXT,
  xml_url TEXT,
  invoice_number TEXT,
  validation_code TEXT,
  rps_number TEXT,
  
  -- Snapshot
  snapshot_json JSONB,
  snapshot_locked BOOLEAN NOT NULL DEFAULT false,
  
  -- Idempotência
  idempotency_key TEXT,
  
  -- Erro
  error_message TEXT,
  error_details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_inv_tenant ON public.fiscal_invoices(tenant_id);
CREATE INDEX idx_fiscal_inv_status ON public.fiscal_invoices(tenant_id, status);
CREATE INDEX idx_fiscal_inv_asaas ON public.fiscal_invoices(asaas_invoice_id);

CREATE POLICY "fiscal_inv_select" ON public.fiscal_invoices FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_inv_insert" ON public.fiscal_invoices FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_inv_update" ON public.fiscal_invoices FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_inv_delete" ON public.fiscal_invoices FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_invoice_items ─────────────────────────────────────
CREATE TABLE public.fiscal_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_items_invoice ON public.fiscal_invoice_items(invoice_id);

CREATE POLICY "fiscal_items_select" ON public.fiscal_invoice_items FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_items_insert" ON public.fiscal_invoice_items FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_items_update" ON public.fiscal_invoice_items FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_items_delete" ON public.fiscal_invoice_items FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_invoice_events (audit/event sourcing) ─────────────
CREATE TABLE public.fiscal_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  old_status TEXT,
  new_status TEXT,
  payload JSONB DEFAULT '{}',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_invoice_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_events_invoice ON public.fiscal_invoice_events(invoice_id);

CREATE POLICY "fiscal_events_select" ON public.fiscal_invoice_events FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_events_insert" ON public.fiscal_invoice_events FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_provider_requests (logs redigidos) ────────────────
CREATE TABLE public.fiscal_provider_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  request_body_redacted JSONB,
  response_status INTEGER,
  response_body_redacted JSONB,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_provider_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_prov_req_tenant ON public.fiscal_provider_requests(tenant_id);

CREATE POLICY "fiscal_prov_req_select" ON public.fiscal_provider_requests FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_prov_req_insert" ON public.fiscal_provider_requests FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── fiscal_provider_webhooks (raw) ───────────────────────────
CREATE TABLE public.fiscal_provider_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  event_type TEXT,
  raw_payload JSONB NOT NULL,
  signature_valid BOOLEAN,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  invoice_id UUID REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fiscal_provider_webhooks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_fiscal_wh_tenant ON public.fiscal_provider_webhooks(tenant_id);

CREATE POLICY "fiscal_wh_select" ON public.fiscal_provider_webhooks FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_wh_insert" ON public.fiscal_provider_webhooks FOR INSERT WITH CHECK (true);

-- ── fiscal_idempotency ───────────────────────────────────────
CREATE TABLE public.fiscal_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, operation, idempotency_key)
);
ALTER TABLE public.fiscal_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_idemp_select" ON public.fiscal_idempotency FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "fiscal_idemp_insert" ON public.fiscal_idempotency FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ── Triggers updated_at ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_fiscal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fiscal_settings_upd BEFORE UPDATE ON public.fiscal_settings FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_updated_at();
CREATE TRIGGER trg_fiscal_mun_req_upd BEFORE UPDATE ON public.fiscal_municipal_requirements FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_updated_at();
CREATE TRIGGER trg_fiscal_mun_svc_upd BEFORE UPDATE ON public.fiscal_municipal_services FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_updated_at();
CREATE TRIGGER trg_fiscal_invoices_upd BEFORE UPDATE ON public.fiscal_invoices FOR EACH ROW EXECUTE FUNCTION public.update_fiscal_updated_at();

-- ── Snapshot lock trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_fiscal_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.snapshot_locked = true THEN
    IF NEW.snapshot_json IS DISTINCT FROM OLD.snapshot_json
       OR NEW.service_description IS DISTINCT FROM OLD.service_description
       OR NEW.value IS DISTINCT FROM OLD.value
       OR NEW.deductions IS DISTINCT FROM OLD.deductions
       OR NEW.taxes IS DISTINCT FROM OLD.taxes
       OR NEW.municipal_service_id IS DISTINCT FROM OLD.municipal_service_id
       OR NEW.municipal_service_code IS DISTINCT FROM OLD.municipal_service_code THEN
      RAISE EXCEPTION 'Snapshot locked: fiscal invoice data cannot be modified after authorization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_fiscal_inv_snapshot_lock BEFORE UPDATE ON public.fiscal_invoices FOR EACH ROW EXECUTE FUNCTION public.protect_fiscal_snapshot();
