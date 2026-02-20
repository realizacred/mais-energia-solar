
-- 1. Allow all authenticated users in the same tenant to see each other's profiles
-- This is needed for the internal team chat and general collaboration
CREATE POLICY rls_profiles_select_team ON public.profiles
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND tenant_and_user_active()
);

-- Drop the more restrictive policies that are now superseded
DROP POLICY IF EXISTS rls_profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS rls_profiles_select_own ON public.profiles;

-- 2. Fix appointments: consultants see only their own, admins see all
DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
FOR SELECT
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND (
    is_admin(auth.uid())
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
);
