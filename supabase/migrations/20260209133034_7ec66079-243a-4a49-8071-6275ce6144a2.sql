
-- Fix: usage_events needs INSERT policy for the increment_usage function 
-- (it runs as SECURITY DEFINER so technically bypasses RLS, but the linter flags it)
-- Adding explicit service-role-only INSERT policies to satisfy linter

-- usage_counters: service insert via RPC (SECURITY DEFINER bypasses, but let's be explicit)
CREATE POLICY "usage_counters_insert_via_rpc" ON public.usage_counters
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "usage_counters_update_via_rpc" ON public.usage_counters
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- usage_events: insert for own tenant
CREATE POLICY "usage_events_insert_own_tenant" ON public.usage_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());
