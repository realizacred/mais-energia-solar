
-- 1) Deletar tabela órfã storage_migration_log
DROP TABLE IF EXISTS public.storage_migration_log;

-- 2) Restringir proposta_aceite_tokens: anon só pode SELECT com token válido
DROP POLICY IF EXISTS "Acesso público por token" ON public.proposta_aceite_tokens;
CREATE POLICY "Acesso público por token válido"
ON public.proposta_aceite_tokens
FOR SELECT
USING (
  expires_at > now()
  AND used_at IS NULL
);

-- 3) Restringir wa_health_checks: apenas usuários autenticados do mesmo tenant
DROP POLICY IF EXISTS "select_own_tenant" ON public.wa_health_checks;
DROP POLICY IF EXISTS "insert_own_tenant" ON public.wa_health_checks;
DROP POLICY IF EXISTS "Authenticated users can view health checks" ON public.wa_health_checks;
DROP POLICY IF EXISTS "Authenticated users can insert health checks" ON public.wa_health_checks;

CREATE POLICY "select_own_tenant"
ON public.wa_health_checks
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "insert_own_tenant"
ON public.wa_health_checks
FOR INSERT
TO authenticated
WITH CHECK (tenant_id = get_user_tenant_id());
