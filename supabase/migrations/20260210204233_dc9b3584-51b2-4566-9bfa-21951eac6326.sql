
-- Fix 1: Drop and recreate orcamentos insert policy to:
--   a) Allow both anon and authenticated roles
--   b) Allow observacoes (remove restriction)
--   c) Keep security validations
DROP POLICY IF EXISTS "rls_orcamentos_insert_public" ON public.orcamentos;

CREATE POLICY "rls_orcamentos_insert_public"
ON public.orcamentos
FOR INSERT
TO public
WITH CHECK (
  tenant_id IS NOT NULL
  AND lead_id IS NOT NULL
  AND tipo_telhado IS NOT NULL
  AND area IS NOT NULL
  AND estado IS NOT NULL
  AND cidade IS NOT NULL
  AND rede_atendimento IS NOT NULL
  AND media_consumo IS NOT NULL
  AND media_consumo > 0
  AND consumo_previsto IS NOT NULL
  AND consumo_previsto > 0
  AND visto = false
  AND visto_admin = false
  AND status_id IS NULL
  AND orc_code IS NULL
);

-- Fix 2: Also update leads insert policy to allow role 'public' (anon + authenticated)
-- and relax cidade/estado for the split lead+orcamento flow
DROP POLICY IF EXISTS "rls_leads_insert_public" ON public.leads;

CREATE POLICY "rls_leads_insert_public"
ON public.leads
FOR INSERT
TO public
WITH CHECK (
  tenant_id IS NOT NULL
  AND nome IS NOT NULL
  AND length(TRIM(nome)) >= 2
  AND telefone IS NOT NULL
  AND length(TRIM(telefone)) >= 10
  AND visto = false
  AND visto_admin = false
  AND status_id IS NULL
);
