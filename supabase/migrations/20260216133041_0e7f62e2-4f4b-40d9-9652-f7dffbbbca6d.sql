
-- =============================================================
-- PAYMENT GATEWAY INFRASTRUCTURE (Multi-tenant, Asaas-first)
-- =============================================================

-- 1. Gateway config per tenant (API keys, environment)
CREATE TABLE public.payment_gateway_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'asaas',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

ALTER TABLE public.payment_gateway_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gateway config"
  ON public.payment_gateway_config
  FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 2. Charges bridge table (links parcelas to gateway transactions)
CREATE TABLE public.payment_gateway_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parcela_id UUID NOT NULL REFERENCES public.parcelas(id) ON DELETE CASCADE,
  recebimento_id UUID NOT NULL REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'asaas',
  gateway_charge_id TEXT,              -- ID do boleto/pix no gateway
  gateway_status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, overdue, refunded, cancelled
  billing_type TEXT,                   -- BOLETO, PIX, CREDIT_CARD
  pix_payload TEXT,                    -- copia-e-cola / QR code data
  pix_qr_code_url TEXT,               -- URL da imagem QR
  boleto_pdf_url TEXT,                 -- link direto do PDF
  boleto_digitable_line TEXT,          -- linha digitável
  due_date DATE,
  paid_at TIMESTAMPTZ,
  value NUMERIC(12,2) NOT NULL,
  net_value NUMERIC(12,2),            -- valor líquido após taxas
  fee NUMERIC(10,2),                  -- taxa do gateway
  gateway_raw_response JSONB,         -- resposta completa para auditoria
  webhook_last_event TEXT,
  webhook_last_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view charges"
  ON public.payment_gateway_charges
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

CREATE POLICY "Admins can manage charges"
  ON public.payment_gateway_charges
  FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- Indexes for performance
CREATE INDEX idx_pgc_tenant_provider ON public.payment_gateway_config(tenant_id, provider);
CREATE INDEX idx_pgcharges_tenant ON public.payment_gateway_charges(tenant_id);
CREATE INDEX idx_pgcharges_parcela ON public.payment_gateway_charges(parcela_id);
CREATE INDEX idx_pgcharges_gateway_id ON public.payment_gateway_charges(gateway_charge_id);
CREATE INDEX idx_pgcharges_status ON public.payment_gateway_charges(gateway_status);

-- Updated_at trigger
CREATE TRIGGER update_payment_gateway_config_updated_at
  BEFORE UPDATE ON public.payment_gateway_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_gateway_charges_updated_at
  BEFORE UPDATE ON public.payment_gateway_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
