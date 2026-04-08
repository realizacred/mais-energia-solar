
CREATE OR REPLACE FUNCTION registrar_view_proposta(
  p_token text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_screen_width integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token proposta_aceite_tokens%ROWTYPE;
  v_is_first boolean;
  v_deal_id uuid;
BEGIN
  SELECT * INTO v_token FROM proposta_aceite_tokens
  WHERE token = p_token AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'token_invalido');
  END IF;

  IF v_token.tipo = 'public' THEN
    RETURN jsonb_build_object(
      'ok', true, 'first_view', false,
      'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id, 'skipped', true
    );
  END IF;

  v_is_first := (v_token.first_viewed_at IS NULL);

  UPDATE proposta_aceite_tokens SET
    view_count = COALESCE(view_count, 0) + 1,
    first_viewed_at = COALESCE(first_viewed_at, now()),
    last_viewed_at = now()
  WHERE id = v_token.id;

  INSERT INTO proposta_views (tenant_id, token_id, proposta_id, versao_id, ip_address, user_agent, referrer, device_type, screen_width)
  VALUES (v_token.tenant_id, v_token.id, v_token.proposta_id, v_token.versao_id, p_ip, p_user_agent, p_referrer, p_device_type, p_screen_width);

  UPDATE propostas_nativas SET
    primeiro_acesso_em = COALESCE(primeiro_acesso_em, now()),
    ultimo_acesso_em = now(),
    total_aberturas = total_aberturas + 1,
    status_visualizacao = 'aberto'
  WHERE id = v_token.proposta_id;

  IF v_is_first THEN
    UPDATE proposta_versoes SET viewed_at = now() WHERE id = v_token.versao_id;

    SELECT p.deal_id INTO v_deal_id
    FROM propostas_nativas pn
    LEFT JOIN projetos p ON p.proposta_id = pn.id
    WHERE pn.id = v_token.proposta_id LIMIT 1;

    IF v_deal_id IS NOT NULL THEN
      INSERT INTO project_events (tenant_id, deal_id, event_type, metadata)
      VALUES (v_token.tenant_id, v_deal_id, 'proposal.viewed', jsonb_build_object(
        'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id, 'token_id', v_token.id
      ));
    END IF;
  END IF;

  INSERT INTO proposal_events (proposta_id, tipo, payload, tenant_id)
  VALUES (
    v_token.proposta_id, 'proposta_visualizada',
    jsonb_build_object(
      'versao_id', v_token.versao_id, 'token_id', v_token.id,
      'view_count', COALESCE(v_token.view_count, 0) + 1,
      'first_view', v_is_first, 'ip_address', p_ip,
      'device_type', p_device_type, 'screen_width', p_screen_width
    ),
    v_token.tenant_id
  );

  RETURN jsonb_build_object('ok', true, 'first_view', v_is_first,
    'proposta_id', v_token.proposta_id, 'versao_id', v_token.versao_id);
END;
$$;
