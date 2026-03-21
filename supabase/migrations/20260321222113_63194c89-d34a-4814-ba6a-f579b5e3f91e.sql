-- Phase 2.4: Overflow credit redistribution

-- 1. Add overflow columns to gd_group_beneficiaries
ALTER TABLE public.gd_group_beneficiaries
  ADD COLUMN IF NOT EXISTS priority_order integer NULL,
  ADD COLUMN IF NOT EXISTS allow_overflow_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_overflow_out boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.gd_group_beneficiaries.priority_order IS 'Priority order for receiving overflow credits (lower = higher priority)';
COMMENT ON COLUMN public.gd_group_beneficiaries.allow_overflow_in IS 'Whether this UC can receive surplus from other UCs';
COMMENT ON COLUMN public.gd_group_beneficiaries.allow_overflow_out IS 'Whether this UC can cede surplus to other UCs';

-- 2. Add overflow fields to gd_monthly_allocations
ALTER TABLE public.gd_monthly_allocations
  ADD COLUMN IF NOT EXISTS overflow_received_kwh numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overflow_ceded_kwh numeric NOT NULL DEFAULT 0;

-- 3. Create gd_monthly_overflows table for traceability
CREATE TABLE IF NOT EXISTS public.gd_monthly_overflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT (current_tenant_id()) REFERENCES public.tenants(id),
  snapshot_id uuid NOT NULL,
  gd_group_id uuid NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  from_uc_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  to_uc_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  overflow_kwh numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gd_monthly_overflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.gd_monthly_overflows
  FOR ALL TO authenticated
  USING (tenant_id = (SELECT current_tenant_id()))
  WITH CHECK (tenant_id = (SELECT current_tenant_id()));

CREATE INDEX IF NOT EXISTS idx_gd_monthly_overflows_snapshot ON public.gd_monthly_overflows(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_gd_monthly_overflows_group ON public.gd_monthly_overflows(gd_group_id);

-- 4. Add total_overflow_kwh to gd_monthly_snapshots
ALTER TABLE public.gd_monthly_snapshots
  ADD COLUMN IF NOT EXISTS total_overflow_kwh numeric NOT NULL DEFAULT 0;