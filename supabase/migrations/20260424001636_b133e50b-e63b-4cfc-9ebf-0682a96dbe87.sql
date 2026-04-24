DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_total_raw int;
  v_orfas int;
  v_inseridas int;
  v_links int;
  v_versoes int;
  v_deletadas_pn int;
BEGIN
  SET LOCAL row_security = off;

  -- Limpeza prévia
  DELETE FROM proposta_versoes
   WHERE tenant_id = v_tenant
     AND proposta_id IN (
       SELECT id FROM propostas_nativas
       WHERE tenant_id = v_tenant AND external_source = 'solarmarket'
     );

  DELETE FROM external_entity_links
   WHERE tenant_id = v_tenant AND source = 'solarmarket' AND entity_type = 'proposta';

  DELETE FROM propostas_nativas
   WHERE tenant_id = v_tenant AND external_source = 'solarmarket';
  GET DIAGNOSTICS v_deletadas_pn = ROW_COUNT;
  RAISE NOTICE '[ETAPA 3] Limpeza prévia — propostas removidas=%', v_deletadas_pn;

  SELECT COUNT(*) INTO v_total_raw FROM sm_propostas_raw WHERE tenant_id = v_tenant;
  RAISE NOTICE '[ETAPA 3] Início — total raw=%', v_total_raw;

  -- Migração
  WITH base AS (
    SELECT
      r.payload                                  AS p,
      (r.payload->>'_sm_project_id')             AS sm_proj_id,
      LOWER(NULLIF(r.payload->>'status',''))     AS sm_status,
      r.payload->>'name'                         AS sm_titulo,
      r.payload->>'createdAt'                    AS sm_created,
      r.payload->>'sendAt'                       AS sm_sent_at,
      r.payload->>'viewedAt'                     AS sm_viewed_at,
      r.payload->>'acceptanceDate'               AS sm_approved_at,
      r.payload->>'rejectionDate'                AS sm_rejected_at,
      r.payload->>'generatedAt'                  AS sm_generated_at
    FROM sm_propostas_raw r
    WHERE r.tenant_id = v_tenant
  ),
  resolved AS (
    SELECT
      b.*,
      (SELECT eel.entity_id
         FROM external_entity_links eel
        WHERE eel.tenant_id = v_tenant
          AND eel.entity_type = 'projeto'
          AND eel.source = 'solarmarket'
          AND eel.source_entity_id = b.sm_proj_id
        LIMIT 1) AS projeto_id_res,
      CASE b.sm_status
        WHEN 'approved'  THEN 'aceita'
        WHEN 'viewed'    THEN 'enviada'
        WHEN 'sent'      THEN 'enviada'
        WHEN 'generated' THEN 'enviada'
        ELSE 'rascunho'
      END AS status_pn,
      (CASE b.sm_status
        WHEN 'approved'  THEN 'accepted'
        WHEN 'viewed'    THEN 'sent'
        WHEN 'sent'      THEN 'sent'
        WHEN 'generated' THEN 'sent'
        ELSE 'draft'
      END)::proposta_nativa_status AS status_pv
    FROM base b
  ),
  com_projeto AS (
    SELECT r.*,
           p.cliente_id   AS cliente_id_res,
           p.consultor_id AS consultor_id_res,
           p.id           AS projeto_id_final
    FROM resolved r
    JOIN projetos p ON p.id = r.projeto_id_res
    WHERE r.projeto_id_res IS NOT NULL
  ),
  inserted_pn AS (
    INSERT INTO propostas_nativas (
      tenant_id, projeto_id, cliente_id, consultor_id,
      titulo, codigo, status, origem, versao_atual,
      enviada_at, aceita_at, recusada_at,
      external_source, external_id, created_at, updated_at
    )
    SELECT
      v_tenant,
      cp.projeto_id_final,
      cp.cliente_id_res,
      cp.consultor_id_res,
      COALESCE(NULLIF(cp.sm_titulo,''), 'Proposta SM ' || cp.sm_proj_id),
      'SM-PROP-' || cp.sm_proj_id,
      cp.status_pn,
      'imported',
      1,
      CASE WHEN cp.status_pn = 'enviada' THEN
        COALESCE(
          NULLIF(cp.sm_sent_at,'')::timestamptz,
          NULLIF(cp.sm_viewed_at,'')::timestamptz,
          NULLIF(cp.sm_generated_at,'')::timestamptz,
          NULLIF(cp.sm_created,'')::timestamptz
        )
      END,
      CASE WHEN cp.status_pn = 'aceita' THEN
        COALESCE(
          NULLIF(cp.sm_approved_at,'')::timestamptz,
          NULLIF(cp.sm_created,'')::timestamptz
        )
      END,
      CASE WHEN cp.sm_status = 'rejected' THEN
        NULLIF(cp.sm_rejected_at,'')::timestamptz
      END,
      'solarmarket',
      cp.sm_proj_id,
      COALESCE(NULLIF(cp.sm_created,'')::timestamptz, now()),
      COALESCE(NULLIF(cp.sm_created,'')::timestamptz, now())
    FROM com_projeto cp
    ON CONFLICT (tenant_id, codigo) DO NOTHING
    RETURNING id, external_id
  ),
  inserted_links AS (
    INSERT INTO external_entity_links (
      tenant_id, entity_type, entity_id, source, source_entity_type, source_entity_id, promoted_at
    )
    SELECT v_tenant, 'proposta', ipn.id, 'solarmarket', 'proposal', ipn.external_id, now()
    FROM inserted_pn ipn
    ON CONFLICT DO NOTHING
    RETURNING id
  ),
  inserted_versoes AS (
    INSERT INTO proposta_versoes (
      tenant_id, proposta_id, versao_numero, status,
      snapshot, gerado_em, observacoes
    )
    SELECT
      v_tenant,
      ipn.id,
      1,
      (SELECT cp.status_pv FROM com_projeto cp WHERE cp.sm_proj_id = ipn.external_id LIMIT 1),
      (SELECT cp.p        FROM com_projeto cp WHERE cp.sm_proj_id = ipn.external_id LIMIT 1),
      COALESCE(
        (SELECT NULLIF(cp.sm_created,'')::timestamptz FROM com_projeto cp WHERE cp.sm_proj_id = ipn.external_id LIMIT 1),
        now()
      ),
      'Importada do SolarMarket'
    FROM inserted_pn ipn
    RETURNING id
  )
  SELECT
    (SELECT COUNT(*) FROM inserted_pn),
    (SELECT COUNT(*) FROM inserted_links),
    (SELECT COUNT(*) FROM inserted_versoes)
  INTO v_inseridas, v_links, v_versoes;

  -- Órfãs (sem projeto migrado)
  SELECT COUNT(*) INTO v_orfas
  FROM sm_propostas_raw r
  WHERE r.tenant_id = v_tenant
    AND NOT EXISTS (
      SELECT 1 FROM external_entity_links eel
       WHERE eel.tenant_id = v_tenant
         AND eel.entity_type = 'projeto'
         AND eel.source = 'solarmarket'
         AND eel.source_entity_id = (r.payload->>'_sm_project_id')
    );

  RAISE NOTICE '[ETAPA 3] Concluída — inseridas=% | links=% | versoes=% | orfas (sem projeto)=%',
    v_inseridas, v_links, v_versoes, v_orfas;
END $$;