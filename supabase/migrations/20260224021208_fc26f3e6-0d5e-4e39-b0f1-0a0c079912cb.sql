
-- Fix: webhook insert policy — webhooks são inseridos via service_role nas Edge Functions
-- O WITH CHECK (true) é necessário porque webhooks não têm auth context
-- Mas vamos trocar para ser via service_role only (sem anon access)
DROP POLICY IF EXISTS "fiscal_wh_insert" ON public.fiscal_provider_webhooks;

-- Webhooks são inseridos somente via Edge Functions com service_role
-- Não precisa de policy INSERT para anon/authenticated
-- O service_role bypassa RLS automaticamente
