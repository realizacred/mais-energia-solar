CREATE OR REPLACE FUNCTION public.register_proposal_event(
  p_token   text,
  p_tipo    text,
  p_src     text DEFAULT 'direct',
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row   public.proposta_aceite_tokens%ROWTYPE;
  v_event_id    uuid;
  v_allowed_tipo CONSTANT text[] := ARRAY['web_open','pdf_open','pdf_download'];
  v_allowed_src  CONSTANT text[] := ARRAY['qr','copy_link','copy_pdf','whatsapp','email','direct'];
  v_src         text;
  v_payload     jsonb;
BEGIN
  IF p_tipo IS NULL OR NOT (p_tipo = ANY (v_allowed_tipo)) THEN
    RAISE EXCEPTION 'invalid_event_tipo' USING ERRCODE = '22023';
  END IF;

  v_src := COALESCE(NULLIF(p_src, ''), 'direct');
  IF NOT (v_src = ANY (v_allowed_src)) THEN
    RAISE EXCEPTION 'invalid_event_src' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_token_row
  FROM public.proposta_aceite_tokens
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;

  IF v_token_row.invalidado_em IS NOT NULL THEN
    RAISE EXCEPTION 'invalidated_token' USING ERRCODE = '22023';
  END IF;

  IF v_token_row.expires_at IS NOT NULL AND v_token_row.expires_at < now() THEN
    RAISE EXCEPTION 'expired_token' USING ERRCODE = '22023';
  END IF;

  v_payload := COALESCE(p_payload, '{}'::jsonb)
             || jsonb_build_object(
                  'src', v_src,
                  'token_id', v_token_row.id,
                  'versao_id', v_token_row.versao_id
                );

  INSERT INTO public.proposal_events (proposta_id, tenant_id, tipo, payload, user_id)
  VALUES (
    v_token_row.proposta_id,
    v_token_row.tenant_id,
    p_tipo,
    v_payload,
    NULL
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_proposal_event(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_proposal_event(text, text, text, jsonb) TO anon, authenticated;