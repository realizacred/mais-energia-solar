
CREATE TABLE public.unit_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.monitor_plants(id) ON DELETE SET NULL,
  quantidade_kwh NUMERIC(12, 2) NOT NULL CHECK (quantidade_kwh > 0),
  data_vigencia DATE NOT NULL,
  posto_tarifario TEXT NOT NULL DEFAULT 'fora_ponta',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unit_credits_unit ON public.unit_credits(unit_id);
CREATE INDEX idx_unit_credits_tenant ON public.unit_credits(tenant_id);

ALTER TABLE public.unit_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.unit_credits
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation insert" ON public.unit_credits
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation update" ON public.unit_credits
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation delete" ON public.unit_credits
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER update_unit_credits_updated_at
  BEFORE UPDATE ON public.unit_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
