
-- price_variants: A/B test pricing for plans
CREATE TABLE public.price_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.price_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active price variants"
  ON public.price_variants FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage price variants"
  ON public.price_variants FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- tenant_price_variant: sticky assignment per tenant+plan
CREATE TABLE public.tenant_price_variant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.price_variants(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, plan_id)
);

ALTER TABLE public.tenant_price_variant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tenant variant"
  ON public.tenant_price_variant FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "System can insert variant assignment"
  ON public.tenant_price_variant FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Admins can read all variants"
  ON public.tenant_price_variant FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for fast lookups
CREATE INDEX idx_price_variants_plan_active ON public.price_variants(plan_id) WHERE is_active = true;
CREATE INDEX idx_tenant_price_variant_tenant ON public.tenant_price_variant(tenant_id);

-- Seed default variants from current plan prices
INSERT INTO public.price_variants (plan_id, name, price_monthly, price_yearly, is_active, weight)
SELECT id, 'default', price_monthly, price_yearly, true, 100
FROM public.plans
WHERE is_active = true;
