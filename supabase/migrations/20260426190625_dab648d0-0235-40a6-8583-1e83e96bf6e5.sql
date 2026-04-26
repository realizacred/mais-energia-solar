DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_proposta_ids uuid[];
  v_versao_ids uuid[];
  v_kit_ids uuid[];
  v_projeto_ids uuid[];
  v_cliente_ids uuid[];
  v_deal_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_proposta_ids FROM propostas_nativas
    WHERE tenant_id=v_tenant AND external_source IN ('solarmarket','solar_market');
  SELECT array_agg(id) INTO v_projeto_ids FROM projetos
    WHERE tenant_id=v_tenant AND external_source IN ('solarmarket','solar_market');
  SELECT array_agg(id) INTO v_cliente_ids FROM clientes
    WHERE tenant_id=v_tenant AND external_source IN ('solarmarket','solar_market');
  SELECT array_agg(deal_id) INTO v_deal_ids FROM projetos
    WHERE tenant_id=v_tenant AND external_source IN ('solarmarket','solar_market') AND deal_id IS NOT NULL;

  -- 1. Versões/kits/UCs primeiro
  IF v_proposta_ids IS NOT NULL THEN
    SELECT array_agg(id) INTO v_versao_ids FROM proposta_versoes WHERE proposta_id = ANY(v_proposta_ids);
    IF v_versao_ids IS NOT NULL THEN
      SELECT array_agg(id) INTO v_kit_ids FROM proposta_kits WHERE versao_id = ANY(v_versao_ids);
      IF v_kit_ids IS NOT NULL THEN
        DELETE FROM proposta_kit_itens WHERE kit_id = ANY(v_kit_ids);
        DELETE FROM proposta_kits WHERE id = ANY(v_kit_ids);
      END IF;
      DELETE FROM proposta_versao_ucs WHERE versao_id = ANY(v_versao_ids);
      DELETE FROM proposta_versoes WHERE id = ANY(v_versao_ids);
    END IF;
    UPDATE projetos SET proposta_id = NULL WHERE proposta_id = ANY(v_proposta_ids);
    DELETE FROM propostas_nativas WHERE id = ANY(v_proposta_ids);
  END IF;

  -- 2. Deals ANTES de projetos (deals.projeto_id é NOT NULL)
  IF v_deal_ids IS NOT NULL THEN
    DELETE FROM deal_custom_field_values WHERE deal_id = ANY(v_deal_ids);
    DELETE FROM deals WHERE id = ANY(v_deal_ids);
  END IF;

  -- 3. Quaisquer outros deals que apontem para esses projetos
  IF v_projeto_ids IS NOT NULL THEN
    DELETE FROM deal_custom_field_values WHERE deal_id IN (SELECT id FROM deals WHERE projeto_id = ANY(v_projeto_ids));
    DELETE FROM deals WHERE projeto_id = ANY(v_projeto_ids);
    DELETE FROM projetos WHERE id = ANY(v_projeto_ids);
  END IF;

  IF v_cliente_ids IS NOT NULL THEN
    DELETE FROM clientes WHERE id = ANY(v_cliente_ids);
  END IF;

  DELETE FROM external_entity_links
    WHERE tenant_id=v_tenant AND source IN ('solarmarket','solar_market');

  DELETE FROM solarmarket_promotion_logs WHERE tenant_id=v_tenant;
END $$;