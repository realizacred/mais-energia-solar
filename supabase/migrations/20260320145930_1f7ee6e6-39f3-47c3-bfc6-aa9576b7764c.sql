
-- Table to store estimated (approximate) financial reports for plants
CREATE TABLE public.plant_estimated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.monitor_plants(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tarifa_kwh NUMERIC(10,4) NOT NULL,
  credito_kwh NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_investido NUMERIC(12,2),
  geracao_periodo_kwh NUMERIC(12,2),
  desempenho_pct NUMERIC(6,2),
  retorno_estimado NUMERIC(12,2),
  retorno_pct NUMERIC(6,2),
  is_estimated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT valid_period CHECK (period_end >= period_start)
);

ALTER TABLE public.plant_estimated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select"
  ON public.plant_estimated_reports FOR SELECT
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - insert"
  ON public.plant_estimated_reports FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - delete"
  ON public.plant_estimated_reports FOR DELETE
  TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX idx_plant_estimated_reports_plant ON public.plant_estimated_reports(plant_id);
CREATE INDEX idx_plant_estimated_reports_tenant ON public.plant_estimated_reports(tenant_id);
