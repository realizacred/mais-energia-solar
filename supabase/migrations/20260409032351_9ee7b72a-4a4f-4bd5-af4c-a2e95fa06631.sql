-- Fix RLS policies on proposta_config: profiles.id → profiles.user_id

DROP POLICY IF EXISTS "Tenant members can insert proposta_config" ON public.proposta_config;
DROP POLICY IF EXISTS "Tenant members can update proposta_config" ON public.proposta_config;
DROP POLICY IF EXISTS "Tenant members can view proposta_config" ON public.proposta_config;

CREATE POLICY "Tenant members can view proposta_config"
  ON public.proposta_config FOR SELECT
  USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Tenant members can insert proposta_config"
  ON public.proposta_config FOR INSERT
  WITH CHECK (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Tenant members can update proposta_config"
  ON public.proposta_config FOR UPDATE
  USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.user_id = auth.uid()));
