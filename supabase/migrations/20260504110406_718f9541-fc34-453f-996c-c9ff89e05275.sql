-- Fix RLS policies on equipment_enrichment_jobs to use get_user_tenant_id()
-- (project standard) instead of auth.jwt() app_metadata which is not populated.

DROP POLICY IF EXISTS "Tenant users can create enrichment jobs" ON public.equipment_enrichment_jobs;
DROP POLICY IF EXISTS "Tenant users can view own enrichment jobs" ON public.equipment_enrichment_jobs;
DROP POLICY IF EXISTS "Tenant users can cancel own enrichment jobs" ON public.equipment_enrichment_jobs;

CREATE POLICY "Tenant users can create enrichment jobs"
  ON public.equipment_enrichment_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id() AND created_by = auth.uid());

CREATE POLICY "Tenant users can view own enrichment jobs"
  ON public.equipment_enrichment_jobs
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant users can cancel own enrichment jobs"
  ON public.equipment_enrichment_jobs
  FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());