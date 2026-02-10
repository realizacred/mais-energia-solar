-- Fix: Remove orc_code IS NULL from orcamentos INSERT policy
-- The generate_orc_code trigger runs BEFORE INSERT and sets orc_code,
-- so by the time the RLS WITH CHECK evaluates, orc_code is already non-null.
-- This was silently blocking ALL orcamento inserts.

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
  status_id IS NULL
);