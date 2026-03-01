
-- Monitoring billing: subscriptions for clients paying for monitoring
CREATE TABLE public.monitor_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (auth.jwt()->>'tenant_id')::uuid REFERENCES public.tenants(id),
  client_id UUID REFERENCES public.clientes(id),
  plan_name TEXT NOT NULL DEFAULT 'basic',
  price_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  plant_ids UUID[] DEFAULT '{}',
  max_plants INTEGER DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for monitor_subscriptions"
  ON public.monitor_subscriptions FOR ALL
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);

CREATE TRIGGER update_monitor_subscriptions_updated_at
  BEFORE UPDATE ON public.monitor_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Billing history
CREATE TABLE public.monitor_billing_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (auth.jwt()->>'tenant_id')::uuid REFERENCES public.tenants(id),
  subscription_id UUID NOT NULL REFERENCES public.monitor_subscriptions(id) ON DELETE CASCADE,
  reference_month INTEGER NOT NULL,
  reference_year INTEGER NOT NULL,
  amount_brl NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for monitor_billing_records"
  ON public.monitor_billing_records FOR ALL
  USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt()->>'tenant_id')::uuid);
