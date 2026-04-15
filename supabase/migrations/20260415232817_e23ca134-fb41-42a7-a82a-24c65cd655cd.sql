
-- =============================================
-- 1. Fix billing_customers: remove public policy, add tenant-scoped
-- =============================================
DROP POLICY IF EXISTS "Service role full access billing_customers" ON public.billing_customers;

CREATE POLICY "service_role_full_billing_customers"
ON public.billing_customers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "tenant_select_billing_customers"
ON public.billing_customers FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- =============================================
-- 2. Fix billing_charges: remove public policy, add tenant-scoped
-- =============================================
DROP POLICY IF EXISTS "Service role full access billing_charges" ON public.billing_charges;

CREATE POLICY "service_role_full_billing_charges"
ON public.billing_charges FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "tenant_select_billing_charges"
ON public.billing_charges FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- =============================================
-- 3. Fix upsell_events: remove public policy, restrict to service_role
-- =============================================
DROP POLICY IF EXISTS "Service role full access on upsell_events" ON public.upsell_events;

CREATE POLICY "service_role_full_upsell_events"
ON public.upsell_events FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 4. Fix _wa_merge_backup: enable RLS, restrict to service_role
-- =============================================
ALTER TABLE public._wa_merge_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_wa_merge_backup"
ON public._wa_merge_backup FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 5. Create sm_consultor_mapping table (replaces VENDEDOR_MAP hardcoded)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sm_consultor_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sm_name text NOT NULL,
  canonical_name text NOT NULL,
  consultor_id uuid REFERENCES public.consultores(id) ON DELETE SET NULL,
  is_ex_funcionario boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_name)
);

ALTER TABLE public.sm_consultor_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_sm_consultor_mapping"
ON public.sm_consultor_mapping FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_manage_sm_consultor_mapping"
ON public.sm_consultor_mapping FOR ALL
TO authenticated
USING (tenant_id = public.get_user_tenant_id())
WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "service_role_full_sm_consultor_mapping"
ON public.sm_consultor_mapping FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_sm_consultor_mapping_tenant ON public.sm_consultor_mapping(tenant_id);
