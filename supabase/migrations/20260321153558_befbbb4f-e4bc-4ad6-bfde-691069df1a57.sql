
-- =============================================
-- billing_customers: Asaas customer per tenant
-- =============================================
CREATE TABLE public.billing_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  asaas_customer_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  cpf_cnpj TEXT,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, asaas_customer_id)
);

CREATE INDEX idx_billing_customers_tenant ON public.billing_customers(tenant_id);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view billing customers"
  ON public.billing_customers FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access billing_customers"
  ON public.billing_customers FOR ALL
  USING (true) WITH CHECK (true);

-- =============================================
-- billing_charges: Asaas charges for plan upgrades
-- =============================================
CREATE TABLE public.billing_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_customer_id UUID REFERENCES public.billing_customers(id),
  asaas_charge_id TEXT,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  valor NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','canceled','expired','overdue')),
  due_date DATE NOT NULL,
  invoice_url TEXT,
  payment_link TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_charges_tenant ON public.billing_charges(tenant_id);
CREATE INDEX idx_billing_charges_asaas ON public.billing_charges(asaas_charge_id);

ALTER TABLE public.billing_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view billing charges"
  ON public.billing_charges FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access billing_charges"
  ON public.billing_charges FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_billing_charges_updated_at
  BEFORE UPDATE ON public.billing_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
