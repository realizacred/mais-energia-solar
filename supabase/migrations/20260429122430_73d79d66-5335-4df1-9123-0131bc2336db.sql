-- Função de chunk: apaga até 200 projetos/clientes por chamada e retorna se ainda há mais
CREATE OR REPLACE FUNCTION public.reset_project_area_chunk(p_tenant_id uuid, p_batch_size int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_ids uuid[];
  v_cliente_ids uuid[];
  v_deal_ids uuid[];
  v_proposta_ids uuid[];
  v_remaining int;
  v_deleted_projetos int := 0;
  v_deleted_clientes int := 0;
BEGIN
  -- 1) Pega lote de projetos do tenant
  SELECT array_agg(id) INTO v_projeto_ids
  FROM (
    SELECT id FROM projetos WHERE tenant_id = p_tenant_id LIMIT p_batch_size
  ) t;

  IF v_projeto_ids IS NOT NULL THEN
    -- Pega deals e propostas relacionados
    SELECT array_agg(id) INTO v_deal_ids FROM deals WHERE projeto_id = ANY(v_projeto_ids);
    SELECT array_agg(id) INTO v_proposta_ids FROM propostas_nativas WHERE projeto_id = ANY(v_projeto_ids);

    -- Apaga em ordem de dependência
    DELETE FROM deal_custom_field_values WHERE deal_id = ANY(COALESCE(v_deal_ids, ARRAY[]::uuid[]));
    DELETE FROM proposta_versao_ucs WHERE versao_id IN (SELECT id FROM proposta_versoes WHERE proposta_id = ANY(COALESCE(v_proposta_ids, ARRAY[]::uuid[])));
    DELETE FROM proposta_kit_itens WHERE kit_id IN (SELECT id FROM proposta_kits WHERE versao_id IN (SELECT id FROM proposta_versoes WHERE proposta_id = ANY(COALESCE(v_proposta_ids, ARRAY[]::uuid[]))));
    DELETE FROM proposta_kits WHERE versao_id IN (SELECT id FROM proposta_versoes WHERE proposta_id = ANY(COALESCE(v_proposta_ids, ARRAY[]::uuid[])));
    DELETE FROM proposta_versoes WHERE proposta_id = ANY(COALESCE(v_proposta_ids, ARRAY[]::uuid[]));
    DELETE FROM propostas_nativas WHERE id = ANY(COALESCE(v_proposta_ids, ARRAY[]::uuid[]));
    DELETE FROM deals WHERE id = ANY(COALESCE(v_deal_ids, ARRAY[]::uuid[]));
    DELETE FROM projeto_funis WHERE projeto_id = ANY(v_projeto_ids);
    DELETE FROM projeto_etapas WHERE projeto_id = ANY(v_projeto_ids);
    DELETE FROM external_entity_links WHERE entity_id = ANY(v_projeto_ids) AND entity_type = 'projeto';
    DELETE FROM projetos WHERE id = ANY(v_projeto_ids);

    GET DIAGNOSTICS v_deleted_projetos = ROW_COUNT;
  END IF;

  -- 2) Pega lote de clientes órfãos (sem projetos restantes)
  SELECT array_agg(id) INTO v_cliente_ids
  FROM (
    SELECT c.id FROM clientes c
    WHERE c.tenant_id = p_tenant_id
      AND c.external_source = 'solarmarket'
      AND NOT EXISTS (SELECT 1 FROM projetos p WHERE p.cliente_id = c.id)
    LIMIT p_batch_size
  ) t;

  IF v_cliente_ids IS NOT NULL THEN
    DELETE FROM external_entity_links WHERE entity_id = ANY(v_cliente_ids) AND entity_type = 'cliente';
    DELETE FROM clientes WHERE id = ANY(v_cliente_ids);
    GET DIAGNOSTICS v_deleted_clientes = ROW_COUNT;
  END IF;

  -- 3) Conta o que sobrou
  SELECT
    (SELECT COUNT(*) FROM projetos WHERE tenant_id = p_tenant_id) +
    (SELECT COUNT(*) FROM clientes WHERE tenant_id = p_tenant_id AND external_source = 'solarmarket')
  INTO v_remaining;

  RETURN jsonb_build_object(
    'deleted_projetos', v_deleted_projetos,
    'deleted_clientes', v_deleted_clientes,
    'remaining', v_remaining,
    'done', v_remaining = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_project_area_chunk(uuid, int) TO authenticated, service_role;