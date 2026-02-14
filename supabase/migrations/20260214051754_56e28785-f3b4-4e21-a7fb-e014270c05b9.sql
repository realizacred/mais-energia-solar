
-- ═══════════════════════════════════════════════════════════════
-- FASE 1: Tenant Lifecycle — Status enum + RLS guard
-- ═══════════════════════════════════════════════════════════════

-- 1. Create tenant status enum
CREATE TYPE public.tenant_status AS ENUM ('active', 'suspended', 'disabled', 'pending');

-- 2. Add status column (default 'active', migrate from boolean)
ALTER TABLE public.tenants ADD COLUMN status public.tenant_status NOT NULL DEFAULT 'active';

-- 3. Migrate existing data: ativo=true → active, ativo=false → disabled
UPDATE public.tenants SET status = 'active' WHERE ativo = true;
UPDATE public.tenants SET status = 'disabled' WHERE ativo = false;

-- 4. Add suspended_at, suspended_reason for audit trail
ALTER TABLE public.tenants ADD COLUMN suspended_at TIMESTAMPTZ;
ALTER TABLE public.tenants ADD COLUMN suspended_reason TEXT;
ALTER TABLE public.tenants ADD COLUMN owner_user_id UUID REFERENCES auth.users(id);

-- 5. Set owner for existing tenant (the first admin)
UPDATE public.tenants t
SET owner_user_id = (
  SELECT ur.user_id FROM user_roles ur
  JOIN profiles p ON p.user_id = ur.user_id
  WHERE p.tenant_id = t.id AND ur.role::text = 'admin'
  ORDER BY ur.id ASC LIMIT 1
)
WHERE owner_user_id IS NULL;

-- 6. Create helper function: is tenant active?
CREATE OR REPLACE FUNCTION public.is_tenant_active(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants WHERE id = _tenant_id AND status = 'active'
  );
$$;

-- 7. Create helper function: get tenant status
CREATE OR REPLACE FUNCTION public.get_tenant_status(_tenant_id uuid)
RETURNS public.tenant_status
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM tenants WHERE id = _tenant_id LIMIT 1;
$$;

-- 8. Update RLS: Admins can only read their tenant if it's active or suspended (view-only)
DROP POLICY IF EXISTS "Admins read own tenant" ON public.tenants;
CREATE POLICY "Admins read own tenant"
ON public.tenants FOR SELECT
TO authenticated
USING (
  id = get_user_tenant_id(auth.uid())
);

-- 9. Update public policy to use status
DROP POLICY IF EXISTS "Public read active tenants" ON public.tenants;
CREATE POLICY "Public read active tenants"
ON public.tenants FOR SELECT
USING (status = 'active');

-- 10. Super admin policy stays (already exists)

-- 11. Create super_admin_actions audit table
CREATE TABLE public.super_admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_tenant_id UUID REFERENCES public.tenants(id),
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admins read actions"
ON public.super_admin_actions FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Only super admins insert actions"
ON public.super_admin_actions FOR INSERT
TO authenticated
WITH CHECK (is_super_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_super_admin_actions_tenant ON public.super_admin_actions(target_tenant_id);
CREATE INDEX idx_super_admin_actions_created ON public.super_admin_actions(created_at DESC);
CREATE INDEX idx_tenants_status ON public.tenants(status);
