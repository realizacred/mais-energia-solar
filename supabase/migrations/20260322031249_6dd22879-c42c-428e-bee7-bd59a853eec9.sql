-- Update resolve_uc_client_token to include meter readings and more UC data
CREATE OR REPLACE FUNCTION public.resolve_uc_client_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok uc_client_tokens%ROWTYPE;
  v_uc units_consumidoras%ROWTYPE;
  v_tenant_name TEXT;
  v_brand JSON;
  v_conc_nome TEXT;
BEGIN
  SELECT * INTO v_tok FROM uc_client_tokens
  WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN json_build_object('error', 'invalid_token'); END IF;

  UPDATE uc_client_tokens SET last_accessed_at = now() WHERE id = v_tok.id;

  SELECT * INTO v_uc FROM units_consumidoras WHERE id = v_tok.unit_id;
  SELECT nome INTO v_tenant_name FROM tenants WHERE id = v_tok.tenant_id;

  -- Get concessionaria name from table if linked
  IF v_uc.concessionaria_id IS NOT NULL THEN
    SELECT nome INTO v_conc_nome FROM concessionarias WHERE id = v_uc.concessionaria_id;
  END IF;

  SELECT json_build_object('logo_url', bs.logo_url, 'color_primary', bs.color_primary, 'company_name', v_tenant_name)
  INTO v_brand FROM brand_settings bs WHERE bs.tenant_id = v_tok.tenant_id LIMIT 1;

  RETURN json_build_object(
    'unit_id', v_uc.id, 'unit_name', v_uc.nome, 'codigo_uc', v_uc.codigo_uc,
    'concessionaria_nome', COALESCE(v_conc_nome, v_uc.concessionaria_nome),
    'tipo_uc', v_uc.tipo_uc,
    'tenant_id', v_tok.tenant_id, 'brand', COALESCE(v_brand, '{}'::json),
    'ultima_leitura_data', v_uc.ultima_leitura_data,
    'ultima_leitura_kwh_03', v_uc.ultima_leitura_kwh_03,
    'ultima_leitura_kwh_103', v_uc.ultima_leitura_kwh_103,
    'potencia_kwp', v_uc.potencia_kwp,
    'categoria_gd', v_uc.categoria_gd,
    'papel_gd', v_uc.papel_gd
  );
END;
$$;