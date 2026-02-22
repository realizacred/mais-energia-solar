
-- Preview seed data counts (safe read-only function)
CREATE OR REPLACE FUNCTION public.preview_seed_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_deal_ids uuid[];
  v_projeto_ids uuid[];
  v_proposta_count int;
  v_versao_count int;
  v_projeto_count int;
  v_deal_count int;
  v_cliente_count int;
BEGIN
  v_tenant_id := require_tenant_id();

  -- Collect seed deal IDs
  SELECT array_agg(id) INTO v_deal_ids
  FROM deals
  WHERE tenant_id = v_tenant_id AND title ILIKE 'Projeto Seed%';

  v_deal_ids := COALESCE(v_deal_ids, '{}');

  -- Collect projeto IDs linked to seed deals
  SELECT array_agg(id) INTO v_projeto_ids
  FROM projetos
  WHERE tenant_id = v_tenant_id AND deal_id = ANY(v_deal_ids);

  v_projeto_ids := COALESCE(v_projeto_ids, '{}');

  -- Count propostas seed
  SELECT count(*) INTO v_proposta_count
  FROM propostas_nativas
  WHERE tenant_id = v_tenant_id AND titulo ILIKE 'Proposta Seed%';

  -- Count proposta_versoes linked to seed propostas
  SELECT count(*) INTO v_versao_count
  FROM proposta_versoes
  WHERE tenant_id = v_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = v_tenant_id AND titulo ILIKE 'Proposta Seed%');

  v_projeto_count := COALESCE(array_length(v_projeto_ids, 1), 0);
  v_deal_count := COALESCE(array_length(v_deal_ids, 1), 0);

  SELECT count(*) INTO v_cliente_count
  FROM clientes
  WHERE tenant_id = v_tenant_id
    AND (nome ILIKE 'Cliente Teste%' OR telefone = '11999990000');

  RETURN jsonb_build_object(
    'proposta_versoes', v_versao_count,
    'propostas', v_proposta_count,
    'projetos', v_projeto_count,
    'deals', v_deal_count,
    'clientes', v_cliente_count
  );
END;
$$;

-- Delete seed data in correct FK order
CREATE OR REPLACE FUNCTION public.delete_seed_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_deal_ids uuid[];
  v_proposta_ids uuid[];
  v_projeto_ids uuid[];
  v_cnt int;
  v_result jsonb := '{}';
BEGIN
  v_tenant_id := require_tenant_id();

  -- 1) Collect seed deal IDs
  SELECT array_agg(id) INTO v_deal_ids
  FROM deals
  WHERE tenant_id = v_tenant_id AND title ILIKE 'Projeto Seed%';
  v_deal_ids := COALESCE(v_deal_ids, '{}');

  -- 2) Collect seed proposta IDs
  SELECT array_agg(id) INTO v_proposta_ids
  FROM propostas_nativas
  WHERE tenant_id = v_tenant_id AND titulo ILIKE 'Proposta Seed%';
  v_proposta_ids := COALESCE(v_proposta_ids, '{}');

  -- 3) Collect projeto IDs linked to seed deals
  SELECT array_agg(id) INTO v_projeto_ids
  FROM projetos
  WHERE tenant_id = v_tenant_id AND deal_id = ANY(v_deal_ids);
  v_projeto_ids := COALESCE(v_projeto_ids, '{}');

  -- A) Delete proposta_versoes first (child of propostas)
  DELETE FROM proposta_versoes
  WHERE tenant_id = v_tenant_id AND proposta_id = ANY(v_proposta_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_result := v_result || jsonb_build_object('proposta_versoes_deleted', v_cnt);

  -- B) Delete propostas_nativas
  DELETE FROM propostas_nativas
  WHERE tenant_id = v_tenant_id AND id = ANY(v_proposta_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_result := v_result || jsonb_build_object('propostas_deleted', v_cnt);

  -- C) Delete projetos
  DELETE FROM projetos
  WHERE tenant_id = v_tenant_id AND id = ANY(v_projeto_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_result := v_result || jsonb_build_object('projetos_deleted', v_cnt);

  -- D) Delete deals
  DELETE FROM deals
  WHERE tenant_id = v_tenant_id AND id = ANY(v_deal_ids);
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_result := v_result || jsonb_build_object('deals_deleted', v_cnt);

  -- E) Delete clientes seed
  DELETE FROM clientes
  WHERE tenant_id = v_tenant_id
    AND (nome ILIKE 'Cliente Teste%' OR telefone = '11999990000');
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_result := v_result || jsonb_build_object('clientes_deleted', v_cnt);

  RETURN v_result;
END;
$$;
