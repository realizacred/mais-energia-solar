-- Fix RLS policies on sm_operation_runs to use get_user_tenant_id() instead of auth.jwt()
-- The JWT in this app does NOT contain tenant_id, so the old policies blocked all user access

DROP POLICY IF EXISTS "Users can view own tenant runs" ON public.sm_operation_runs;
DROP POLICY IF EXISTS "Users can insert own tenant runs" ON public.sm_operation_runs;
DROP POLICY IF EXISTS "Users can update own tenant runs" ON public.sm_operation_runs;

CREATE POLICY "Users can view own tenant runs"
  ON public.sm_operation_runs FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert own tenant runs"
  ON public.sm_operation_runs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update own tenant runs"
  ON public.sm_operation_runs FOR UPDATE
  TO authenticated
  USING (tenant_id = get_user_tenant_id());