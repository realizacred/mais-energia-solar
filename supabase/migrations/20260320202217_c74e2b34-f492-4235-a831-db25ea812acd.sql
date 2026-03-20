
-- Fase 3: Tabela de log de alertas de leitura enviados

CREATE TABLE public.unit_reading_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL DEFAULT 'leitura',
  reference_month INTEGER NOT NULL,
  reference_year INTEGER NOT NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, alert_type, reference_month, reference_year)
);

ALTER TABLE public.unit_reading_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their alerts"
  ON public.unit_reading_alerts FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_unit_reading_alerts_lookup 
  ON public.unit_reading_alerts(unit_id, alert_type, reference_month, reference_year);

COMMENT ON TABLE public.unit_reading_alerts IS 'Log de alertas de leitura enviados para evitar duplicatas';
