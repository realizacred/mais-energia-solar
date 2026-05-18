-- Drop existing select policy to replace with a more reliable one
DROP POLICY IF EXISTS "Tenant isolation - select" ON public.fornecedores;
DROP POLICY IF EXISTS "tenant_select_fornecedores" ON public.fornecedores;

-- Create the new select policy using current_tenant_id()
CREATE POLICY "tenant_select_fornecedores"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (tenant_id = current_tenant_id());