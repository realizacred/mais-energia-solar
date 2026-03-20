
-- Table for meter alerts
CREATE TABLE public.meter_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meter_device_id UUID NOT NULL REFERENCES public.meter_devices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  tipo TEXT NOT NULL CHECK (tipo IN ('tensao_baixa','tensao_alta','sobrecarga','offline')),
  valor_atual NUMERIC,
  valor_limite NUMERIC,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  resolvido_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meter_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant can view own meter alerts"
  ON public.meter_alerts FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant can insert own meter alerts"
  ON public.meter_alerts FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant can update own meter alerts"
  ON public.meter_alerts FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_meter_alerts_device ON public.meter_alerts(meter_device_id, resolvido);
CREATE INDEX idx_meter_alerts_tenant ON public.meter_alerts(tenant_id);
