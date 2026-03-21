
-- ============================================================
-- GD Energy Engine Tables — Phase 2
-- ============================================================

-- 1. gd_monthly_snapshots — snapshot mensal do grupo GD
CREATE TABLE public.gd_monthly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  reference_year integer NOT NULL,
  reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  generation_kwh numeric(12,2) NOT NULL DEFAULT 0,
  generator_consumption_kwh numeric(12,2) NOT NULL DEFAULT 0,
  total_allocated_kwh numeric(12,2) NOT NULL DEFAULT 0,
  total_compensated_kwh numeric(12,2) NOT NULL DEFAULT 0,
  total_surplus_kwh numeric(12,2) NOT NULL DEFAULT 0,
  total_deficit_kwh numeric(12,2) NOT NULL DEFAULT 0,
  calculation_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gd_group_id, reference_year, reference_month)
);

ALTER TABLE public.gd_monthly_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.gd_monthly_snapshots
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- 2. gd_monthly_allocations — resultado mensal por beneficiária
CREATE TABLE public.gd_monthly_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  snapshot_id uuid NOT NULL REFERENCES public.gd_monthly_snapshots(id) ON DELETE CASCADE,
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  uc_beneficiaria_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  allocation_percent numeric(5,2) NOT NULL DEFAULT 0,
  allocated_kwh numeric(12,2) NOT NULL DEFAULT 0,
  consumed_kwh numeric(12,2) NOT NULL DEFAULT 0,
  compensated_kwh numeric(12,2) NOT NULL DEFAULT 0,
  surplus_kwh numeric(12,2) NOT NULL DEFAULT 0,
  deficit_kwh numeric(12,2) NOT NULL DEFAULT 0,
  estimated_savings_brl numeric(12,2),
  source_invoice_id uuid REFERENCES public.unit_invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (snapshot_id, uc_beneficiaria_id)
);

ALTER TABLE public.gd_monthly_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.gd_monthly_allocations
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- 3. gd_credit_balances — saldo acumulado por UC beneficiária
CREATE TABLE public.gd_credit_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_setting('request.jwt.claims'::text, true)::json ->> 'tenant_id')::uuid REFERENCES public.tenants(id),
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  uc_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  balance_kwh numeric(12,2) NOT NULL DEFAULT 0,
  last_reference_year integer,
  last_reference_month integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gd_group_id, uc_id)
);

ALTER TABLE public.gd_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.gd_credit_balances
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- Indexes for performance
CREATE INDEX idx_gd_monthly_snapshots_group ON public.gd_monthly_snapshots(gd_group_id, reference_year, reference_month);
CREATE INDEX idx_gd_monthly_allocations_snapshot ON public.gd_monthly_allocations(snapshot_id);
CREATE INDEX idx_gd_monthly_allocations_uc ON public.gd_monthly_allocations(uc_beneficiaria_id);
CREATE INDEX idx_gd_credit_balances_uc ON public.gd_credit_balances(uc_id);
