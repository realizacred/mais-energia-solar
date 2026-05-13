
-- 1. concessionarias: scope SELECT to same tenant
DROP POLICY IF EXISTS rls_concessionarias_select_authenticated ON public.concessionarias;
CREATE POLICY rls_concessionarias_select_authenticated
  ON public.concessionarias
  FOR SELECT
  TO authenticated
  USING (ativo = true AND tenant_id = get_user_tenant_id());

-- 2. config_tributaria_estado: drop public anon read, scope to tenant
DROP POLICY IF EXISTS rls_config_tributaria_estado_select_public ON public.config_tributaria_estado;
CREATE POLICY rls_config_tributaria_estado_select_authenticated
  ON public.config_tributaria_estado
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 3. payback_config: same
DROP POLICY IF EXISTS rls_payback_config_select_public ON public.payback_config;
CREATE POLICY rls_payback_config_select_authenticated
  ON public.payback_config
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 4. fio_b_escalonamento: same
DROP POLICY IF EXISTS rls_fio_b_escalonamento_select_public ON public.fio_b_escalonamento;
CREATE POLICY rls_fio_b_escalonamento_select_authenticated
  ON public.fio_b_escalonamento
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 5. client_portal_users: hide password_hash from API roles (column-level revoke)
REVOKE SELECT (password_hash) ON public.client_portal_users FROM anon, authenticated;

-- 6. proposta_sync_audit_log: restrict reads to admins (no tenant_id column)
DROP POLICY IF EXISTS "audit log read for authenticated" ON public.proposta_sync_audit_log;
CREATE POLICY rls_proposta_sync_audit_log_select_admin
  ON public.proposta_sync_audit_log
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- 7. proposal-signatures storage: per-tenant folder enforcement on read + insert
DROP POLICY IF EXISTS "Tenant users can read signatures" ON storage.objects;
CREATE POLICY "Tenant users can read signatures"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'proposal-signatures'
    AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
  );

DROP POLICY IF EXISTS "Tenant users can upload signatures" ON storage.objects;
CREATE POLICY "Tenant users can upload signatures"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-signatures'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = (get_user_tenant_id())::text
  );

-- 8. vw_orcamentos_comercial: enforce caller-side RLS via security_invoker
ALTER VIEW public.vw_orcamentos_comercial SET (security_invoker = true);
