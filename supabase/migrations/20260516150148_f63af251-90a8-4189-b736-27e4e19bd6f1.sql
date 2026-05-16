CREATE OR REPLACE FUNCTION public.fn_update_deal_value_from_contract(
  p_deal_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_value NUMERIC;
  v_new_value NUMERIC;
  v_tenant_id UUID;
  v_user_id UUID;
  v_user_email TEXT;
  v_result JSONB;
BEGIN
  -- 1. Obter info do usuário
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 2. Obter valor atual e tenant_id (Implicitamente valida existência)
  SELECT value, tenant_id INTO v_old_value, v_tenant_id
  FROM deals
  WHERE id = p_deal_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Negociação não encontrada ou acesso negado.';
  END IF;

  -- 3. Calcular valor contratado atual (mesma lógica do hook useFinancialSummary)
  SELECT COALESCE(SUM(valor_total), 0) INTO v_new_value
  FROM vendas_transacional
  WHERE deal_id = p_deal_id
  AND status != 'cancelada';

  -- 4. Validações
  IF v_new_value IS NULL OR v_new_value = 0 THEN
    RAISE EXCEPTION 'Nenhuma venda contratada ativa encontrada para esta negociação.';
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'O motivo da atualização é obrigatório.';
  END IF;

  -- 5. Executar update
  UPDATE deals
  SET value = v_new_value,
      updated_at = now()
  WHERE id = p_deal_id;

  -- 6. Registrar Log de Auditoria
  INSERT INTO audit_logs (
    user_id,
    user_email,
    acao,
    tabela,
    registro_id,
    dados_anteriores,
    dados_novos,
    tenant_id
  ) VALUES (
    v_user_id,
    v_user_email,
    'update_deal_value_from_contract',
    'deals',
    p_deal_id,
    jsonb_build_object('value', v_old_value, 'reason', p_reason),
    jsonb_build_object('value', v_new_value),
    v_tenant_id
  );

  v_result := jsonb_build_object(
    'success', true,
    'old_value', v_old_value,
    'new_value', v_new_value,
    'reason', p_reason
  );

  RETURN v_result;
END;
$$;