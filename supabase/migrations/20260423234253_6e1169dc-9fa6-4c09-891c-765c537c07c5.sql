DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_antes_clientes int;
  v_antes_links int;
  v_staging_total int;
  v_inseridos int;
  v_links_criados int;
  v_depois_clientes int;
  v_depois_links int;
BEGIN
  -- BYPASS RLS para esta transação (migration roda fora do contexto auth)
  SET LOCAL row_security = off;

  SELECT COUNT(*) INTO v_antes_clientes
    FROM clientes
    WHERE tenant_id = v_tenant AND external_source IN ('solar_market','solarmarket');

  SELECT COUNT(*) INTO v_antes_links
    FROM external_entity_links
    WHERE tenant_id = v_tenant AND source = 'solarmarket' AND source_entity_type = 'cliente';

  SELECT COUNT(*) INTO v_staging_total
    FROM sm_clientes_raw
    WHERE tenant_id = v_tenant;

  RAISE NOTICE '== ETAPA 1 - CLIENTES (v3) ==';
  RAISE NOTICE 'Tenant: %', v_tenant;
  RAISE NOTICE 'Staging sm_clientes_raw: % registros', v_staging_total;
  RAISE NOTICE 'Clientes SM existentes ANTES: %', v_antes_clientes;
  RAISE NOTICE 'Links SM cliente ANTES: %', v_antes_links;

  WITH novos_clientes AS (
    INSERT INTO clientes (
      tenant_id, cliente_code, nome, telefone, email, cpf_cnpj,
      cep, rua, numero, bairro, cidade, estado, complemento,
      external_source, external_id, origem, ativo
    )
    SELECT
      v_tenant,
      'SM-CLI-' || (r.payload->>'id'),
      COALESCE(NULLIF(TRIM(r.payload->>'name'), ''), 'Cliente SM ' || (r.payload->>'id')),
      COALESCE(
        NULLIF(regexp_replace(
          COALESCE(r.payload->>'primaryPhone', r.payload->>'secondaryPhone',''),
          '[^0-9]', '', 'g'
        ), ''),
        '00000000000'
      ),
      NULLIF(TRIM(r.payload->>'email'), ''),
      NULLIF(regexp_replace(COALESCE(r.payload->>'cnpjCpf',''), '[^0-9]', '', 'g'), ''),
      NULLIF(regexp_replace(COALESCE(r.payload->>'zipCode',''), '[^0-9]', '', 'g'), ''),
      NULLIF(TRIM(r.payload->>'address'), ''),
      NULLIF(TRIM(r.payload->>'number'), ''),
      NULLIF(TRIM(r.payload->>'neighborhood'), ''),
      NULLIF(TRIM(r.payload->>'city'), ''),
      NULLIF(TRIM(r.payload->>'state'), ''),
      NULLIF(TRIM(r.payload->>'complement'), ''),
      'solarmarket',
      (r.payload->>'id'),
      'solar_market',
      true
    FROM sm_clientes_raw r
    WHERE r.tenant_id = v_tenant
      AND (r.payload->>'id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM external_entity_links eel
        WHERE eel.tenant_id = v_tenant
          AND eel.source = 'solarmarket'
          AND eel.source_entity_type = 'cliente'
          AND eel.source_entity_id = (r.payload->>'id')
      )
      AND NOT EXISTS (
        SELECT 1 FROM clientes c
        WHERE c.tenant_id = v_tenant
          AND c.external_source IN ('solar_market','solarmarket')
          AND c.external_id = (r.payload->>'id')
      )
    ON CONFLICT DO NOTHING
    RETURNING id, external_id
  ),
  links_inseridos AS (
    INSERT INTO external_entity_links (
      tenant_id, source, entity_type, entity_id,
      source_entity_type, source_entity_id, promoted_at, metadata
    )
    SELECT
      v_tenant, 'solarmarket', 'cliente', nc.id,
      'cliente', nc.external_id, now(), '{"migrated_via":"sql_step_1"}'::jsonb
    FROM novos_clientes nc
    WHERE NOT EXISTS (
      SELECT 1 FROM external_entity_links eel
      WHERE eel.tenant_id = v_tenant
        AND eel.source = 'solarmarket'
        AND eel.source_entity_type = 'cliente'
        AND eel.source_entity_id = nc.external_id
    )
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*) FROM novos_clientes),
    (SELECT COUNT(*) FROM links_inseridos)
  INTO v_inseridos, v_links_criados;

  SELECT COUNT(*) INTO v_depois_clientes
    FROM clientes
    WHERE tenant_id = v_tenant AND external_source IN ('solar_market','solarmarket');

  SELECT COUNT(*) INTO v_depois_links
    FROM external_entity_links
    WHERE tenant_id = v_tenant AND source = 'solarmarket' AND source_entity_type = 'cliente';

  RAISE NOTICE '-- RESULTADO --';
  RAISE NOTICE 'Clientes inseridos nesta execucao: %', v_inseridos;
  RAISE NOTICE 'Links criados nesta execucao: %', v_links_criados;
  RAISE NOTICE 'Clientes SM DEPOIS: % (delta: %)', v_depois_clientes, v_depois_clientes - v_antes_clientes;
  RAISE NOTICE 'Links SM cliente DEPOIS: % (delta: %)', v_depois_links, v_depois_links - v_antes_links;
  RAISE NOTICE '== FIM ETAPA 1 ==';
END $$;