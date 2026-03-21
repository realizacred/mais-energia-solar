CREATE TABLE public.gd_generation_reconciliation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.gd_monthly_snapshots(id) ON DELETE SET NULL,
  reference_year integer NOT NULL,
  reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  meter_kwh numeric(12,2),
  monitoring_kwh numeric(12,2),
  invoice_kwh numeric(12,2),
  selected_source text NOT NULL DEFAULT 'missing',
  diff_percent numeric(6,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'critical')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gd_group_id, reference_year, reference_month)
);

ALTER TABLE public.gd_generation_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.gd_generation_reconciliation
  FOR ALL USING (tenant_id = public.current_tenant_id());

CREATE INDEX idx_gd_reconciliation_group ON public.gd_generation_reconciliation(gd_group_id, reference_year, reference_month);