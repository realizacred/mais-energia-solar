
-- =====================================================================
-- ETAPA 2: Migração de PROJETOS do SolarMarket (sm_projetos_raw → projetos)
-- =====================================================================
-- Estratégia:
--  1. Resolver cliente_id em 3 níveis (link → CPF → telefone)
--  2. Resolver consultor_id por:
--     a) funil "Vendedores" no sm_projeto_funis_raw (stage.name → mapping)
--     b) responsible.name → consultores (case-insensitive)
--     c) fallback: Escritório (67153740-7b73-406a-83e8-41ce8d9e456d)
--  3. Funil padrão: Comercial (65f12e49-7ae6-4988-ba4c-14d53d67b661)
--     Etapa padrão: Recebido (8be48233-367d-4338-8c83-fdeece54a4fc)
--  4. Idempotência via NOT EXISTS em external_entity_links + ON CONFLICT
--  5. SET LOCAL row_security = off para bypass de RLS
-- =====================================================================

DO $$
DECLARE
  v_tenant         UUID := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_funil_id       UUID := '65f12e49-7ae6-4988-ba4c-14d53d67b661';
  v_etapa_id       UUID := '8be48233-367d-4338-8c83-fdeece54a4fc';
  v_escritorio_id  UUID := '67153740-7b73-406a-83e8-41ce8d9e456d';
  v_total_raw      INT;
  v_existentes     INT;
  v_orfaos         INT;
  v_inseridos      INT;
  v_links_criados  INT;
BEGIN
  SET LOCAL row_security = off;

  SELECT COUNT(*) INTO v_total_raw
  FROM sm_projetos_raw WHERE tenant_id = v_tenant;

  SELECT COUNT(*) INTO v_existentes
  FROM external_entity_links
  WHERE tenant_id = v_tenant
    AND source = 'solarmarket'
    AND source_entity_type = 'projeto';

  RAISE NOTICE '=== ETAPA 2: Migração de PROJETOS ===';
  RAISE NOTICE 'Total no staging: %', v_total_raw;
  RAISE NOTICE 'Já migrados (links existentes): %', v_existentes;

  -- CTE base: resolve cliente, consultor e dados auxiliares para cada projeto
  WITH base AS (
    SELECT
      r.payload->>'id'                                  AS sm_proj_id,
      r.payload->>'name'                                AS proj_name,
      (r.payload->'client'->>'id')                      AS sm_cli_id,
      regexp_replace(COALESCE(r.payload->'client'->>'cnpjCpf',''), '\D', '', 'g') AS cli_cpf,
      regexp_replace(COALESCE(r.payload->'client'->>'primaryPhone',''), '\D', '', 'g') AS cli_tel,
      lower(trim(COALESCE(r.payload->'responsible'->>'name','')))   AS resp_name_lc,
      r.payload->>'createdAt'                           AS created_at_str
    FROM sm_projetos_raw r
    WHERE r.tenant_id = v_tenant
  ),
  -- Resolve consultor pelo funil "Vendedores" (mais recente por projeto)
  vendedor_funil AS (
    SELECT DISTINCT ON (f.payload->'project'->>'id')
      f.payload->'project'->>'id'  AS sm_proj_id,
      lower(trim(f.payload->'stage'->>'name')) AS stage_name_lc
    FROM sm_projeto_funis_raw f
    WHERE f.tenant_id = v_tenant
      AND lower(f.payload->>'name') = 'vendedores'
    ORDER BY f.payload->'project'->>'id', (f.payload->>'createdAt') DESC NULLS LAST
  ),
  resolved AS (
    SELECT
      b.*,
      -- Cliente: cascata 3 níveis
      COALESCE(
        (SELECT eel.entity_id FROM external_entity_links eel
          WHERE eel.tenant_id = v_tenant
            AND eel.source = 'solarmarket'
            AND eel.source_entity_type = 'cliente'
            AND eel.source_entity_id = b.sm_cli_id
            AND eel.entity_type = 'cliente'
          LIMIT 1),
        (SELECT c.id FROM clientes c
          WHERE c.tenant_id = v_tenant
            AND b.cli_cpf <> ''
            AND regexp_replace(COALESCE(c.cpf_cnpj,''), '\D', '', 'g') = b.cli_cpf
          LIMIT 1),
        (SELECT c.id FROM clientes c
          WHERE c.tenant_id = v_tenant
            AND b.cli_tel <> ''
            AND c.telefone_normalized = b.cli_tel
          LIMIT 1)
      ) AS cliente_id_resolvido,
      -- Consultor: cascata 3 níveis
      COALESCE(
        -- 1. Vendedores funil → sm_consultor_mapping
        (SELECT CASE
                  WHEN m.is_ex_funcionario THEN v_escritorio_id
                  ELSE m.consultor_id
                END
         FROM vendedor_funil vf
         JOIN sm_consultor_mapping m
           ON m.tenant_id = v_tenant
          AND lower(trim(m.sm_name)) = vf.stage_name_lc
         WHERE vf.sm_proj_id = b.sm_proj_id
         LIMIT 1),
        -- 2. responsible.name → consultores (match case-insensitive)
        --    EXCETO Bruno Caetano (gerente, não migrar)
        (SELECT c.id FROM consultores c
          WHERE c.tenant_id = v_tenant
            AND c.ativo = true
            AND b.resp_name_lc <> ''
            AND b.resp_name_lc NOT LIKE '%bruno caetano%'
            AND lower(c.nome) = b.resp_name_lc
          LIMIT 1),
        -- 3. Fallback: Escritório
        v_escritorio_id
      ) AS consultor_id_resolvido
    FROM base b
    -- Filtra projetos já migrados (idempotência)
    WHERE NOT EXISTS (
      SELECT 1 FROM external_entity_links eel
      WHERE eel.tenant_id = v_tenant
        AND eel.source = 'solarmarket'
        AND eel.source_entity_type = 'projeto'
        AND eel.source_entity_id = b.sm_proj_id
    )
  ),
  -- INSERT projetos (apenas com cliente resolvido — zero órfãos)
  novos_projetos AS (
    INSERT INTO projetos (
      tenant_id, codigo, cliente_id, consultor_id,
      funil_id, etapa_id,
      external_source, external_id,
      origem, status,
      created_at, updated_at
    )
    SELECT
      v_tenant,
      'SM-PROJ-' || r.sm_proj_id,
      r.cliente_id_resolvido,
      r.consultor_id_resolvido,
      v_funil_id,
      v_etapa_id,
      'solarmarket',
      r.sm_proj_id,
      'solarmarket',
      'aguardando_documentacao'::projeto_status,
      COALESCE(r.created_at_str::timestamptz, now()),
      now()
    FROM resolved r
    WHERE r.cliente_id_resolvido IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING id, external_id
  ),
  -- INSERT links na mesma transação
  novos_links AS (
    INSERT INTO external_entity_links (
      tenant_id, source,
      source_entity_type, source_entity_id,
      entity_type, entity_id
    )
    SELECT
      v_tenant, 'solarmarket',
      'projeto', np.external_id,
      'projeto', np.id
    FROM novos_projetos np
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM novos_projetos),
    (SELECT COUNT(*) FROM novos_links),
    (SELECT COUNT(*) FROM resolved WHERE cliente_id_resolvido IS NULL)
  INTO v_inseridos, v_links_criados, v_orfaos;

  RAISE NOTICE 'Projetos inseridos: %', v_inseridos;
  RAISE NOTICE 'Links criados: %', v_links_criados;
  RAISE NOTICE 'Projetos descartados (sem cliente resolvido / órfãos): %', v_orfaos;
  RAISE NOTICE '=== FIM ETAPA 2 ===';
END $$;
