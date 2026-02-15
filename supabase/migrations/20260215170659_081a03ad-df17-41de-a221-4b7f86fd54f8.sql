-- Fix overly permissive INSERT policy on automation logs
DROP POLICY IF EXISTS "Service role can insert automation logs" ON public.pipeline_automation_logs;

CREATE POLICY "Tenant users can insert automation logs"
  ON public.pipeline_automation_logs FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());