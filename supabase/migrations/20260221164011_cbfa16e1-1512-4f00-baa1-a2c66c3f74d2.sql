-- Fix RLS policies on tarifa_versoes: profiles.id != auth.uid(), must use profiles.user_id
DROP POLICY IF EXISTS "Tenant isolation - select" ON public.tarifa_versoes;
DROP POLICY IF EXISTS "Tenant isolation - insert" ON public.tarifa_versoes;
DROP POLICY IF EXISTS "Tenant isolation - update" ON public.tarifa_versoes;
DROP POLICY IF EXISTS "Tenant isolation - delete" ON public.tarifa_versoes;

CREATE POLICY "Tenant isolation - select"
  ON public.tarifa_versoes FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - insert"
  ON public.tarifa_versoes FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - update"
  ON public.tarifa_versoes FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation - delete"
  ON public.tarifa_versoes FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));