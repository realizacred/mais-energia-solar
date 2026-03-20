
-- Table for plant resizing/expansion history (ampliação de usina)
CREATE TABLE public.plant_resizing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  potencia_kwp NUMERIC(12, 3) NOT NULL,
  data_ampliacao DATE NOT NULL,
  valor_investido_total NUMERIC(14, 2),
  geracao_anual_prevista_kwh NUMERIC(14, 2),
  geracao_anual_acordada_kwh NUMERIC(14, 2),
  comentario TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plant_resizing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation select" ON public.plant_resizing_history
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation insert" ON public.plant_resizing_history
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation update" ON public.plant_resizing_history
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation delete" ON public.plant_resizing_history
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

CREATE INDEX idx_plant_resizing_plant_id ON public.plant_resizing_history(plant_id);
CREATE INDEX idx_plant_resizing_tenant_id ON public.plant_resizing_history(tenant_id);

CREATE TRIGGER update_plant_resizing_history_updated_at
  BEFORE UPDATE ON public.plant_resizing_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
