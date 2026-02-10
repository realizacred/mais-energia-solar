-- Fix the public insert policy for leads
-- Current policy blocks observacoes and lead_code (set by trigger)
DROP POLICY IF EXISTS rls_leads_insert_public ON public.leads;

CREATE POLICY rls_leads_insert_public ON public.leads
FOR INSERT
WITH CHECK (
  tenant_id IS NOT NULL
  AND nome IS NOT NULL AND length(TRIM(BOTH FROM nome)) >= 2
  AND telefone IS NOT NULL AND length(TRIM(BOTH FROM telefone)) >= 10
  AND cidade IS NOT NULL
  AND estado IS NOT NULL
  AND area IS NOT NULL
  AND tipo_telhado IS NOT NULL
  AND rede_atendimento IS NOT NULL
  AND media_consumo IS NOT NULL AND media_consumo >= 0
  AND consumo_previsto IS NOT NULL AND consumo_previsto >= 0
  AND visto = false
  AND visto_admin = false
  AND status_id IS NULL
  -- Removed: observacoes IS NULL (users can add observations)
  -- Removed: lead_code IS NULL (trigger sets it automatically)
);