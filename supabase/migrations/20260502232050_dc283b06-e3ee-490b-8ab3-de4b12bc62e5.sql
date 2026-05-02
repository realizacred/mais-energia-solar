-- ============================================================
-- FASE 1: Corrigir INSERT policies (CRÍTICO)
-- ============================================================
DROP POLICY IF EXISTS ai_usage_logs_insert ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_insert
  ON public.ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

DROP POLICY IF EXISTS audit_feature_insert ON public.audit_feature_access_log;
CREATE POLICY audit_feature_insert
  ON public.audit_feature_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- ============================================================
-- FASE 2: Converter views para SECURITY INVOKER
-- (passam a respeitar RLS do usuário consultando, não do owner)
-- ============================================================
ALTER VIEW public.estoque_saldos SET (security_invoker = on);
ALTER VIEW public.meter_readings_daily SET (security_invoker = on);
ALTER VIEW public.v_auditoria_telefones SET (security_invoker = on);
ALTER VIEW public.vw_wa_integrity_audit SET (security_invoker = on);

-- ============================================================
-- FASE 3: Restringir authenticated a próprio tenant
-- (anon mantém leitura para suportar landing pages públicas)
-- ============================================================

-- brand_settings
DROP POLICY IF EXISTS rls_brand_settings_select_public ON public.brand_settings;
CREATE POLICY rls_brand_settings_select_anon
  ON public.brand_settings
  FOR SELECT
  TO anon
  USING (true);
CREATE POLICY rls_brand_settings_select_authenticated
  ON public.brand_settings
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- instagram_posts
DROP POLICY IF EXISTS rls_instagram_posts_select_public ON public.instagram_posts;
CREATE POLICY rls_instagram_posts_select_anon
  ON public.instagram_posts
  FOR SELECT
  TO anon
  USING (true);
CREATE POLICY rls_instagram_posts_select_authenticated
  ON public.instagram_posts
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- site_servicos
DROP POLICY IF EXISTS rls_site_servicos_select_public ON public.site_servicos;
CREATE POLICY rls_site_servicos_select_anon
  ON public.site_servicos
  FOR SELECT
  TO anon
  USING (true);
CREATE POLICY rls_site_servicos_select_authenticated
  ON public.site_servicos
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- site_settings
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
CREATE POLICY rls_site_settings_select_anon
  ON public.site_settings
  FOR SELECT
  TO anon
  USING (true);
CREATE POLICY rls_site_settings_select_authenticated
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id());