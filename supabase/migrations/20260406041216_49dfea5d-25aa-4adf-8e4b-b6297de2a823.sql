-- Drop existing policies
DROP POLICY IF EXISTS "Tenant members can manage custom field values" ON public.deal_custom_field_values;
DROP POLICY IF EXISTS "Tenant members can view custom field values" ON public.deal_custom_field_values;

-- Recreate with proper USING + WITH CHECK
CREATE POLICY "tenant_isolation_select" ON public.deal_custom_field_values
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.deal_custom_field_values
FOR INSERT TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.deal_custom_field_values
FOR UPDATE TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.deal_custom_field_values
FOR DELETE TO authenticated
USING (tenant_id = get_user_tenant_id());