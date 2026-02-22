
-- Historical pricing data per tenant for smart defaults
CREATE TABLE public.pricing_defaults_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  proposta_id UUID,
  categoria TEXT NOT NULL, -- 'kit_margem', 'instalacao', 'comissao', 'frete', 'projeto', 'outros'
  potencia_kwp NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  valor_por_kwp NUMERIC NOT NULL DEFAULT 0,
  percentual NUMERIC, -- for commission percentage
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.pricing_defaults_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant isolation select" ON public.pricing_defaults_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant isolation insert" ON public.pricing_defaults_history
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Index for fast lookups
CREATE INDEX idx_pricing_defaults_history_tenant_cat 
  ON public.pricing_defaults_history(tenant_id, categoria, created_at DESC);
