CREATE OR REPLACE FUNCTION public.reset_tenant_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}';
  v_count int;
BEGIN
  -- 1. pagamentos
  DELETE FROM pagamentos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('pagamentos', v_count);

  -- 2. parcelas
  DELETE FROM parcelas WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('parcelas', v_count);

  -- 3. recebimentos
  DELETE FROM recebimentos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('recebimentos', v_count);

  -- 4. proposta_versoes (via subquery)
  DELETE FROM proposta_versoes
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('proposta_versoes', v_count);

  -- 5. propostas_nativas
  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('propostas_nativas', v_count);

  -- 6. projetos (before deals due to FK)
  DELETE FROM projetos WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('projetos', v_count);

  -- 7. deals
  DELETE FROM deals WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('deals', v_count);

  -- 8. clientes
  DELETE FROM clientes WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('clientes', v_count);

  -- 9. solar market tables
  DELETE FROM solar_market_custom_field_values WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_custom_fields WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_proposals WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_projects WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_clients WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnel_stages WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_funnels WHERE tenant_id = p_tenant_id;
  DELETE FROM solar_market_sync_logs WHERE tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  result := result || jsonb_build_object('solar_market', v_count);

  RETURN result;
END;
$$;