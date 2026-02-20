
-- Fix 1: Allow consultors to see ALL contacts in their tenant (not just their own assigned conversations)
DROP POLICY IF EXISTS contacts_select_tenant ON public.contacts;
CREATE POLICY contacts_select_tenant ON public.contacts
FOR SELECT USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = contacts.tenant_id
      AND user_roles.role IN ('admin', 'gerente', 'consultor', 'financeiro')
  )
);
