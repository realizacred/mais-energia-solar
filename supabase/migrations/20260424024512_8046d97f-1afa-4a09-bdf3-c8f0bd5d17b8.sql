DO $$
DECLARE
  v_propostas_sm uuid[];
  v_versoes_sm   uuid[];
  v_kits_sm      uuid[];
  v_projetos_sm  uuid[];
  v_deals_sm     uuid[];
  v_clientes_sm_full   uuid[];
  v_clientes_sm_keep   uuid[];
BEGIN
  SELECT array_agg(id) INTO v_propostas_sm
  FROM propostas_nativas
  WHERE external_source IN ('solar_market','solarmarket');

  SELECT array_agg(id) INTO v_versoes_sm
  FROM proposta_versoes
  WHERE proposta_id = ANY(COALESCE(v_propostas_sm, ARRAY[]::uuid[]));

  SELECT array_agg(id) INTO v_kits_sm
  FROM proposta_kits
  WHERE versao_id = ANY(COALESCE(v_versoes_sm, ARRAY[]::uuid[]));

  SELECT array_agg(id) INTO v_projetos_sm
  FROM projetos
  WHERE external_source IN ('solar_market','solarmarket');

  SELECT array_agg(id) INTO v_deals_sm
  FROM deals
  WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]));

  -- Clientes a preservar: têm conversa WA ou projeto não-SM
  SELECT array_agg(c.id) INTO v_clientes_sm_keep
  FROM clientes c
  WHERE c.external_source IN ('solar_market','solarmarket')
    AND (
      EXISTS (SELECT 1 FROM wa_conversations w WHERE w.cliente_id = c.id)
      OR EXISTS (
        SELECT 1 FROM projetos p
        WHERE p.cliente_id = c.id
          AND (p.external_source IS NULL
               OR p.external_source NOT IN ('solar_market','solarmarket'))
      )
    );

  SELECT array_agg(c.id) INTO v_clientes_sm_full
  FROM clientes c
  WHERE c.external_source IN ('solar_market','solarmarket')
    AND NOT (c.id = ANY(COALESCE(v_clientes_sm_keep, ARRAY[]::uuid[])));

  RAISE NOTICE 'Propostas: %, Versões: %, Kits: %, Projetos: %, Deals: %, Clientes apagar: %, Preservar: %',
    COALESCE(array_length(v_propostas_sm,1),0),
    COALESCE(array_length(v_versoes_sm,1),0),
    COALESCE(array_length(v_kits_sm,1),0),
    COALESCE(array_length(v_projetos_sm,1),0),
    COALESCE(array_length(v_deals_sm,1),0),
    COALESCE(array_length(v_clientes_sm_full,1),0),
    COALESCE(array_length(v_clientes_sm_keep,1),0);

  DELETE FROM proposta_kit_itens
  WHERE kit_id = ANY(COALESCE(v_kits_sm, ARRAY[]::uuid[]));

  DELETE FROM proposta_versao_ucs
  WHERE versao_id = ANY(COALESCE(v_versoes_sm, ARRAY[]::uuid[]));

  DELETE FROM proposta_kits
  WHERE id = ANY(COALESCE(v_kits_sm, ARRAY[]::uuid[]));

  DELETE FROM proposta_versoes
  WHERE id = ANY(COALESCE(v_versoes_sm, ARRAY[]::uuid[]));

  DELETE FROM generated_documents
  WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]))
     OR deal_id    = ANY(COALESCE(v_deals_sm, ARRAY[]::uuid[]));

  DELETE FROM propostas_nativas
  WHERE id = ANY(COALESCE(v_propostas_sm, ARRAY[]::uuid[]));

  DELETE FROM deal_custom_field_values
  WHERE deal_id = ANY(COALESCE(v_deals_sm, ARRAY[]::uuid[]));

  DELETE FROM deal_kanban_projection
  WHERE deal_id = ANY(COALESCE(v_deals_sm, ARRAY[]::uuid[]));

  DELETE FROM checklist_cliente_arquivos
  WHERE checklist_id IN (
    SELECT id FROM checklists_cliente
    WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]))
  );
  DELETE FROM checklist_cliente_respostas
  WHERE checklist_id IN (
    SELECT id FROM checklists_cliente
    WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]))
  );
  DELETE FROM checklists_cliente
  WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]));

  DELETE FROM checklist_instalador_arquivos
  WHERE checklist_id IN (
    SELECT id FROM checklists_instalador
    WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]))
  );
  DELETE FROM checklist_instalador_respostas
  WHERE checklist_id IN (
    SELECT id FROM checklists_instalador
    WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]))
  );
  DELETE FROM checklists_instalador
  WHERE projeto_id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]));

  DELETE FROM deals
  WHERE id = ANY(COALESCE(v_deals_sm, ARRAY[]::uuid[]));

  DELETE FROM projetos
  WHERE id = ANY(COALESCE(v_projetos_sm, ARRAY[]::uuid[]));

  DELETE FROM clientes
  WHERE id = ANY(COALESCE(v_clientes_sm_full, ARRAY[]::uuid[]));

  UPDATE clientes
  SET external_source = NULL,
      external_id     = NULL
  WHERE id = ANY(COALESCE(v_clientes_sm_keep, ARRAY[]::uuid[]));

  DELETE FROM external_entity_links
  WHERE source IN ('solarmarket','solar_market');

  DELETE FROM solarmarket_import_jobs;

  RAISE NOTICE '✅ Limpeza concluída. Staging sm_*_raw preservado.';
END $$;