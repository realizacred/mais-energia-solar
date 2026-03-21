
-- Energy Alerts table for GD monitoring
CREATE TABLE public.energy_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json->>'tenant_id')::uuid,
  gd_group_id UUID REFERENCES public.gd_groups(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units_consumidoras(id) ON DELETE SET NULL,
  plant_id UUID REFERENCES public.monitor_plants(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL, -- 'no_generation', 'missing_invoice', 'allocation_mismatch', 'meter_offline', 'reconciliation_critical'
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  context_json JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_energy_alerts_tenant ON public.energy_alerts(tenant_id);
CREATE INDEX idx_energy_alerts_type ON public.energy_alerts(tenant_id, alert_type);
CREATE INDEX idx_energy_alerts_pending ON public.energy_alerts(tenant_id) WHERE resolved_at IS NULL;

-- RLS
ALTER TABLE public.energy_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for energy_alerts"
  ON public.energy_alerts
  FOR ALL
  TO authenticated
  USING (tenant_id = (current_setting('request.jwt.claims'::text, true)::json->>'tenant_id')::uuid)
  WITH CHECK (tenant_id = (current_setting('request.jwt.claims'::text, true)::json->>'tenant_id')::uuid);
