
-- 1. brand_settings
REVOKE SELECT (representante_legal, representante_cpf, representante_email, representante_cargo)
  ON public.brand_settings FROM anon;

-- 2. site_settings
REVOKE SELECT (google_client_secret, google_redirect_uri)
  ON public.site_settings FROM anon;

-- 3. proposta_aceite_tokens
DROP POLICY IF EXISTS "Anon can read tokens by token value" ON public.proposta_aceite_tokens;
DROP POLICY IF EXISTS "Acesso público por token válido"     ON public.proposta_aceite_tokens;

CREATE OR REPLACE FUNCTION public.get_proposta_token_by_value(p_token uuid)
RETURNS TABLE (
  id uuid,
  token uuid,
  proposta_id uuid,
  versao_id uuid,
  tenant_id uuid,
  tipo text,
  decisao text,
  expires_at timestamptz,
  used_at timestamptz,
  invalidado_em timestamptz,
  motivo_invalidacao text,
  view_count int,
  first_viewed_at timestamptz,
  aceite_nome text,
  termo_aceite_pdf_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.token, t.proposta_id, t.versao_id, t.tenant_id, t.tipo, t.decisao,
         t.expires_at, t.used_at, t.invalidado_em, t.motivo_invalidacao,
         t.view_count, t.first_viewed_at, t.aceite_nome, t.termo_aceite_pdf_url
  FROM public.proposta_aceite_tokens t
  WHERE t.token = p_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_proposta_token_by_value(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_proposta_token_by_value(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_latest_valid_token_for_proposta(p_proposta_id uuid)
RETURNS TABLE (
  id uuid, token uuid, proposta_id uuid, versao_id uuid,
  expires_at timestamptz, invalidado_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.token, t.proposta_id, t.versao_id, t.expires_at, t.invalidado_em
  FROM public.proposta_aceite_tokens t
  WHERE t.proposta_id = p_proposta_id
    AND t.invalidado_em IS NULL
    AND t.used_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > now())
  ORDER BY t.created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_latest_valid_token_for_proposta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_valid_token_for_proposta(uuid) TO anon, authenticated;

-- 4. inversores_audit_log
DROP POLICY IF EXISTS audit_log_admin_read    ON public.inversores_audit_log;
DROP POLICY IF EXISTS audit_log_system_insert ON public.inversores_audit_log;

CREATE POLICY inversores_audit_log_service_only
  ON public.inversores_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
