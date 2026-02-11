
-- C1: Fix wa_instance_vendedores - remove dangerous {public} role policy
DROP POLICY IF EXISTS rls_wa_instance_vendedores_service ON public.wa_instance_vendedores;

-- Recreate as service_role only (for edge functions)
CREATE POLICY "wa_instance_vendedores_service_role"
ON public.wa_instance_vendedores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- C2: Fix vendedores anon select - restrict to tenant-scoped authenticated access only
DROP POLICY IF EXISTS rls_vendedores_select_anon ON public.vendedores;

-- Replace with a scoped policy for public lead forms (only codigo/slug/nome, enforced by RLS filter)
CREATE POLICY "vendedores_select_anon_safe"
ON public.vendedores
FOR SELECT
TO anon
USING (ativo = true);
