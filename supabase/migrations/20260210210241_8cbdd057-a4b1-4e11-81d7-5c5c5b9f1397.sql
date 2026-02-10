
-- Fix: Allow both anon and authenticated users to insert leads and orcamentos
-- The previous policies used role "public" which maps to anon only in some configs

-- Drop and recreate leads INSERT policy
DROP POLICY IF EXISTS "rls_leads_insert_public" ON public.leads;
CREATE POLICY "rls_leads_insert_public" ON public.leads
FOR INSERT TO anon, authenticated
WITH CHECK (
  tenant_id IS NOT NULL AND
  nome IS NOT NULL AND
  length(TRIM(BOTH FROM nome)) >= 2 AND
  telefone IS NOT NULL AND
  length(TRIM(BOTH FROM telefone)) >= 10 AND
  visto = false AND
  visto_admin = false AND
  status_id IS NULL
);

-- Drop and recreate orcamentos INSERT policy
DROP POLICY IF EXISTS "rls_orcamentos_insert_public" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_insert_public" ON public.orcamentos
FOR INSERT TO anon, authenticated
WITH CHECK (
  tenant_id IS NOT NULL AND
  lead_id IS NOT NULL AND
  tipo_telhado IS NOT NULL AND
  area IS NOT NULL AND
  estado IS NOT NULL AND
  cidade IS NOT NULL AND
  rede_atendimento IS NOT NULL AND
  media_consumo IS NOT NULL AND
  media_consumo > 0 AND
  consumo_previsto IS NOT NULL AND
  visto = false AND
  visto_admin = false AND
  status_id IS NULL AND
  orc_code IS NULL
);
