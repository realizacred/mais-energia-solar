
-- Fix integration_configs: change role from public to authenticated
-- This prevents anon users from even attempting these policies

DROP POLICY IF EXISTS "Admins can read integration configs" ON public.integration_configs;
CREATE POLICY "Admins can read integration configs"
  ON public.integration_configs FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can insert integration configs" ON public.integration_configs;
CREATE POLICY "Admins can insert integration configs"
  ON public.integration_configs FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can update integration configs" ON public.integration_configs;
CREATE POLICY "Admins can update integration configs"
  ON public.integration_configs FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());

DROP POLICY IF EXISTS "Admins can delete integration configs" ON public.integration_configs;
CREATE POLICY "Admins can delete integration configs"
  ON public.integration_configs FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id() AND tenant_and_user_active());
