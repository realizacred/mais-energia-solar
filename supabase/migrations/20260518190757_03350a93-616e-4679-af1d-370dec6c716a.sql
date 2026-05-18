-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Tenant users can insert ordens_compra" ON public.ordens_compra;
DROP POLICY IF EXISTS "Tenant users can update ordens_compra" ON public.ordens_compra;
DROP POLICY IF EXISTS "Tenant users can view ordens_compra" ON public.ordens_compra;
DROP POLICY IF EXISTS "Tenant users can delete ordens_compra" ON public.ordens_compra;

-- Create the new more robust policies using current_tenant_id()
CREATE POLICY "tenant_insert_ordens_compra"
ON public.ordens_compra
FOR INSERT 
TO authenticated
WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "tenant_select_ordens_compra"  
ON public.ordens_compra
FOR SELECT 
TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_update_ordens_compra"
ON public.ordens_compra
FOR UPDATE 
TO authenticated
USING (tenant_id = current_tenant_id());

CREATE POLICY "tenant_delete_ordens_compra"
ON public.ordens_compra
FOR DELETE 
TO authenticated
USING (tenant_id = current_tenant_id());