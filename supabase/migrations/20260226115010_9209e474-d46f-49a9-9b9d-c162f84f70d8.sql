
-- Fix RLS: restrict wa_bg_jobs to authenticated users with matching tenant_id
DROP POLICY "Service role full access on wa_bg_jobs" ON public.wa_bg_jobs;

-- Only service_role can access (edge functions use service_role key)
-- Authenticated users can only see their tenant's jobs
CREATE POLICY "Tenant isolation on wa_bg_jobs"
  ON public.wa_bg_jobs
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
