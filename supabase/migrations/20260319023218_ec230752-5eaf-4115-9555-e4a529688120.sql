-- B1: Add missing columns to propostas_nativas
ALTER TABLE propostas_nativas ADD COLUMN IF NOT EXISTS enviada_via text NULL;
ALTER TABLE propostas_nativas ADD COLUMN IF NOT EXISTS enviada_por uuid NULL;
ALTER TABLE propostas_nativas ADD COLUMN IF NOT EXISTS public_token text NULL;

-- B2: Add token_id and mensagem_resumo to proposta_envios
ALTER TABLE proposta_envios ADD COLUMN IF NOT EXISTS token_id uuid NULL REFERENCES proposta_aceite_tokens(id);
ALTER TABLE proposta_envios ADD COLUMN IF NOT EXISTS mensagem_resumo text NULL;
CREATE INDEX IF NOT EXISTS idx_proposta_envios_token ON proposta_envios(token_id);

-- B3+B4+B5: Atomic view tracking function
CREATE OR REPLACE FUNCTION registrar_view_proposta(
  p_token uuid,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token proposta_aceite_tokens%ROWTYPE;
  v_is_first boolean;
BEGIN
  SELECT * INTO v_token FROM proposta_aceite_tokens
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'token_invalido');
  END IF;

  v_is_first := (v_token.first_viewed_at IS NULL);

  -- Atomic increment
  UPDATE proposta_aceite_tokens SET
    view_count = COALESCE(view_count, 0) + 1,
    first_viewed_at = COALESCE(first_viewed_at, now()),
    last_viewed_at = now()
  WHERE id = v_token.id;

  -- Insert view record
  INSERT INTO proposta_views (tenant_id, token_id, proposta_id, versao_id, ip_address, user_agent, referrer)
  VALUES (v_token.tenant_id, v_token.id, v_token.proposta_id, v_token.versao_id, p_ip, p_user_agent, p_referrer);

  -- B5: Update viewed_at on first view
  IF v_is_first THEN
    UPDATE proposta_versoes SET viewed_at = now() WHERE id = v_token.versao_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'first_view', v_is_first,
    'proposta_id', v_token.proposta_id,
    'versao_id', v_token.versao_id
  );
END;
$$;

-- Grant execute to anon (public page calls this)
GRANT EXECUTE ON FUNCTION registrar_view_proposta(uuid, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION registrar_view_proposta(uuid, text, text, text) TO authenticated;