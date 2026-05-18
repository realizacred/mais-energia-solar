-- Drop existing insert policy if it exists to replace with a more reliable one
DROP POLICY IF EXISTS "Tenant isolation - insert" ON public.fornecedores;
DROP POLICY IF EXISTS "tenant_insert_fornecedores" ON public.fornecedores;

-- Create the new insert policy using current_tenant_id()
CREATE POLICY "tenant_insert_fornecedores"
ON public.fornecedores
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = current_tenant_id());