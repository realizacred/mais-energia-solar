
-- 1. Fix DEFAULT on tenant_id
ALTER TABLE public.pipeline_automations
  ALTER COLUMN tenant_id SET DEFAULT (public.get_user_tenant_id(auth.uid()));

-- 2. Drop existing policies
DROP POLICY IF EXISTS "Users can view their tenant automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Users can create automations for their tenant" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Users can update their tenant automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Users can delete their tenant automations" ON public.pipeline_automations;

-- 3. Recreate policies with correct function call
CREATE POLICY "tenant_select_pipeline_automations"
  ON public.pipeline_automations FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_pipeline_automations"
  ON public.pipeline_automations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_pipeline_automations"
  ON public.pipeline_automations FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_delete_pipeline_automations"
  ON public.pipeline_automations FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
