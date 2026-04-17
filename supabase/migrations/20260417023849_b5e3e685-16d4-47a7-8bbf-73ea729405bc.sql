
CREATE OR REPLACE FUNCTION public.sm_migration_dry_run(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id obrigatório';
  END IF;

  WITH classified AS (
    SELECT
      smp.sm_project_id,
      smp.lead_id,
      smp.sm_funnel_name,
      smp.sm_stage_name,
      coalesce(
        smp.raw_payload->'client'->>'primaryPhone',
        smp.raw_payload->'client'->>'secondaryPhone'
      ) AS phone,
      public.sm_classify_funnel_stage(
        p_tenant_id,
        smp.sm_funnel_name,
        smp.sm_stage_name,
        smp.status,
        coalesce(
          smp.raw_payload->'client'->>'primaryPhone',
          smp.raw_payload->'client'->>'secondaryPhone'
        )
      ) AS cls
    FROM public.solar_market_projects smp
    WHERE smp.tenant_id = p_tenant_id
  ),
  enriched AS (
    SELECT
      c.*,
      c.cls->>'pipeline_kind' AS pipeline_kind,
      c.cls->>'funil_canonico' AS funil_canonico,
      c.cls->>'etapa_canonica' AS etapa_canonica,
      c.cls->>'consultor_match_nome' AS consultor_match_nome,
      c.cls->>'motivo_classificacao' AS motivo,
      pf.id AS funil_existente_id,
      pe.id AS etapa_existente_id,
      cons.id AS consultor_existente_id,
      public.sm_phone_is_valid(c.phone) AS phone_ok
    FROM classified c
    LEFT JOIN public.projeto_funis pf
      ON pf.tenant_id = p_tenant_id
     AND lower(btrim(pf.nome)) = lower(c.cls->>'funil_canonico')
    LEFT JOIN public.projeto_etapas pe
      ON pe.tenant_id = p_tenant_id
     AND pe.funil_id = pf.id
     AND lower(btrim(pe.nome)) = lower(c.cls->>'etapa_canonica')
    LEFT JOIN public.consultores cons
      ON cons.tenant_id = p_tenant_id
     AND cons.ativo = true
     AND unaccent(lower(btrim(cons.nome))) = unaccent(lower(btrim(c.cls->>'consultor_match_nome')))
  )
  SELECT jsonb_build_object(
    'tenant_id', p_tenant_id,
    'total_sm_projects', (SELECT count(*) FROM enriched),
    'phone_quality', (
      SELECT jsonb_build_object(
        'validos',   count(*) FILTER (WHERE phone_ok),
        'invalidos', count(*) FILTER (WHERE NOT phone_ok)
      )
      FROM enriched
    ),
    'por_pipeline_kind', (
      SELECT jsonb_object_agg(pipeline_kind, qtd)
      FROM (SELECT pipeline_kind, count(*) qtd FROM enriched GROUP BY pipeline_kind) s
    ),
    'por_funil_canonico', (
      SELECT jsonb_object_agg(coalesce(funil_canonico, '_sem_funil_'), qtd)
      FROM (SELECT funil_canonico, count(*) qtd FROM enriched WHERE pipeline_kind IN ('commercial','technical') GROUP BY funil_canonico) s
    ),
    'por_etapa_comercial', (
      SELECT jsonb_object_agg(coalesce(etapa_canonica,'_sem_etapa_'), qtd)
      FROM (SELECT etapa_canonica, count(*) qtd FROM enriched WHERE funil_canonico='Comercial' GROUP BY etapa_canonica) s
    ),
    'funis_a_criar', (
      SELECT coalesce(jsonb_agg(DISTINCT funil_canonico), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND funil_canonico IS NOT NULL
        AND funil_existente_id IS NULL
    ),
    'etapas_a_criar', (
      SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('funil', funil_canonico, 'etapa', etapa_canonica)), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind IN ('commercial','technical')
        AND etapa_canonica IS NOT NULL
        AND etapa_existente_id IS NULL
    ),
    'consultores_nao_mapeados', (
      SELECT coalesce(jsonb_agg(DISTINCT consultor_match_nome), '[]'::jsonb)
      FROM enriched
      WHERE pipeline_kind = 'responsible_only'
        AND consultor_match_nome IS NOT NULL
        AND consultor_existente_id IS NULL
    ),
    'pendencias', jsonb_build_object(
      'sem_classificacao',   (SELECT count(*) FROM enriched WHERE pipeline_kind = 'unmapped'),
      'dimensao_financeira', (SELECT count(*) FROM enriched WHERE pipeline_kind = 'financial_dimension'),
      'apenas_responsavel',  (SELECT count(*) FROM enriched WHERE pipeline_kind = 'responsible_only'),
      'pipeline_sem_etapa',  (SELECT count(*) FROM enriched WHERE pipeline_kind IN ('commercial','technical') AND etapa_canonica IS NULL),
      'verificar_dados',     (SELECT count(*) FROM enriched WHERE etapa_canonica = 'Verificar Dados')
    ),
    'amostra_telefone_invalido', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('sm_project_id', sm_project_id, 'phone', phone, 'funnel', sm_funnel_name)), '[]'::jsonb)
      FROM (SELECT sm_project_id, phone, sm_funnel_name FROM enriched WHERE NOT phone_ok LIMIT 10) s
    ),
    'amostra_sem_classificacao', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('sm_project_id', sm_project_id, 'funnel', sm_funnel_name, 'stage', sm_stage_name)), '[]'::jsonb)
      FROM (SELECT sm_project_id, sm_funnel_name, sm_stage_name FROM enriched WHERE pipeline_kind='unmapped' LIMIT 10) s
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
