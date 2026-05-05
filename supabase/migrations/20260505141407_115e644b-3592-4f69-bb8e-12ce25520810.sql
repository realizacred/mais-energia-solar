
-- 1) Remove anon SELECT policies (token enumeration)
DROP POLICY IF EXISTS "Public read via valid token" ON public.proposta_grupo_tokens;
DROP POLICY IF EXISTS "Anon can read active tokens" ON public.uc_client_tokens;

-- 2) RPC pública: get grupo by token (mirrors edge function read)
CREATE OR REPLACE FUNCTION public.get_proposta_grupo_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row proposta_grupo_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM proposta_grupo_tokens
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'tenant_id', v_row.tenant_id,
    'projeto_id', v_row.projeto_id,
    'proposta_ids', v_row.proposta_ids,
    'titulo', v_row.titulo,
    'expires_at', v_row.expires_at,
    'view_count', v_row.view_count,
    'kit_aceito_id', v_row.kit_aceito_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proposta_grupo_by_token(uuid) TO anon, authenticated;

-- 3) RPC pública: registrar kit aceito (substitui PATCH REST anon)
CREATE OR REPLACE FUNCTION public.set_grupo_kit_aceito(p_token uuid, p_kit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row proposta_grupo_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM proposta_grupo_tokens WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'token_invalid';
  END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;
  IF NOT (p_kit_id = ANY (v_row.proposta_ids)) THEN
    RAISE EXCEPTION 'kit_not_in_grupo';
  END IF;

  UPDATE proposta_grupo_tokens
  SET kit_aceito_id = p_kit_id
  WHERE id = v_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_grupo_kit_aceito(uuid, uuid) TO anon, authenticated;
