-- Fix: RPC reset_migrated_data referenciava
--      generated_documents.proposta_id (coluna inexistente),
--      causando rollback e impossibilitando reset.
--      Auditoria 2026-04-24.

CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_blocking_op text;

  v_projeto_ids uuid[] := '{}';
  v_deal_ids uuid[] := '{}';
  v_proposta_ids uuid[] := '{}';
  v_versao_ids uuid[] := '{}';
  v_kit_ids uuid[] := '{}';

  v_count_clientes int := 0;
  v_count_projetos int := 0;
  v_count_deals int := 0;
  v_count_propostas int := 0;
  v_count_versoes int := 0;
  v_count_kits int := 0;
  v_count_kit_itens int := 0;
  v_count_ucs int := 0;
  v_count_dcfv int := 0;
  v_count_stage_history int := 0;
  v_count_external_links int := 0;
  v_count_projection int := 0;
  v_count_deal_notes int := 0;
  v_count_deal_pipeline_stages int := 0;
  v_count_proposta_envios int := 0;
  v_count_proposta_aceite_tokens int := 0;
  v_count_proposta_cenarios int := 0;
  v_count_proposta_views int := 0;
  v_count_proposta_historico int := 0;
  v_count_proposal_events int := 0;
  v_count_proposal_followup_queue int := 0;
  v_count_generated_documents int := 0;
  v_summary text;
BEGIN
  IF to_regclass('public.sm_operation_runs') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT operation_type
      FROM public.sm_operation_runs
      WHERE tenant_id = $1
        AND status IN ('queued', 'running')
        AND operation_type IN ('migrate_to_native', 'reset_migrated', 'reset_staging')
        AND (
          heartbeat_at IS NULL
          OR heartbeat_at > NOW() - INTERVAL '15 minutes'
          OR started_at > NOW() - INTERVAL '15 minutes'
        )
      ORDER BY created_at DESC
      LIMIT 1
    $sql$
    INTO v_blocking_op
    USING p_tenant_id;

    IF v_blocking_op IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Reset bloqueado: operação "%s" em andamento.', v_blocking_op)
      );
    END IF;
  END IF;

  IF to_regclass('public.solar_market_sync_logs') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.solar_market_sync_logs
      WHERE tenant_id = p_tenant_id
        AND status = 'running'
        AND started_at > NOW() - INTERVAL '15 minutes'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Reset bloqueado: sincronização em andamento.'
      );
    END IF;

    UPDATE public.solar_market_sync_logs
    SET status = 'failed', finished_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND status = 'running'
      AND started_at <= NOW() - INTERVAL '15 minutes';
  END IF;

  SELECT COALESCE(array_agg(p.id), '{}'::uuid[])
    INTO v_projeto_ids
  FROM public.projetos p
  WHERE p.tenant_id = p_tenant_id
    AND p.external_source = 'solarmarket';

  SELECT COALESCE(array_agg(DISTINCT d.id), '{}'::uuid[])
    INTO v_deal_ids
  FROM public.deals d
  WHERE d.tenant_id = p_tenant_id
    AND (
      d.projeto_id = ANY(v_projeto_ids)
      OR COALESCE(d.origem, '') = 'solarmarket'
    );

  SELECT COALESCE(array_agg(pn.id), '{}'::uuid[])
    INTO v_proposta_ids
  FROM public.propostas_nativas pn
  WHERE pn.tenant_id = p_tenant_id
    AND pn.external_source = 'solarmarket';

  SELECT COALESCE(array_agg(pv.id), '{}'::uuid[])
    INTO v_versao_ids
  FROM public.proposta_versoes pv
  WHERE pv.proposta_id = ANY(v_proposta_ids);

  SELECT COALESCE(array_agg(pk.id), '{}'::uuid[])
    INTO v_kit_ids
  FROM public.proposta_kits pk
  WHERE pk.versao_id = ANY(v_versao_ids);

  UPDATE public.projetos
  SET deal_id = NULL,
      proposta_id = NULL
  WHERE id = ANY(v_projeto_ids)
    AND tenant_id = p_tenant_id;

  WITH deleted AS (
    DELETE FROM public.proposta_kit_itens
    WHERE kit_id = ANY(v_kit_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_kit_itens FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_kits
    WHERE id = ANY(v_kit_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_kits FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_versao_ucs
    WHERE versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_ucs FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_campos_distribuidora
    WHERE versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_views FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_comercial
    WHERE versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) + v_count_proposta_views INTO v_count_proposta_views FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_cenarios
    WHERE versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_cenarios FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_envios
    WHERE versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_envios FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_views
    WHERE proposta_id = ANY(v_proposta_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_views FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_aceite_tokens
    WHERE proposta_id = ANY(v_proposta_ids)
       OR versao_id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_aceite_tokens FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposal_events
    WHERE proposta_id = ANY(v_proposta_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposal_events FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposal_followup_queue
    WHERE proposta_id = ANY(v_proposta_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposal_followup_queue FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_historico
    WHERE proposta_id = ANY(v_proposta_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_proposta_historico FROM deleted;

  -- generated_documents não tem coluna proposta_id;
  -- documentos ligados a propostas são alcançados via projeto_id e deal_id.
  -- Auditoria 2026-04-24.
  WITH deleted AS (
    DELETE FROM public.generated_documents
    WHERE tenant_id = p_tenant_id
      AND (
        projeto_id = ANY(v_projeto_ids)
        OR deal_id = ANY(v_deal_ids)
      )
    RETURNING id
  )
  SELECT count(*) INTO v_count_generated_documents FROM deleted;

  WITH deleted AS (
    DELETE FROM public.proposta_versoes
    WHERE id = ANY(v_versao_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_versoes FROM deleted;

  WITH deleted AS (
    DELETE FROM public.propostas_nativas
    WHERE id = ANY(v_proposta_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_propostas FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deal_custom_field_values
    WHERE deal_id = ANY(v_deal_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_dcfv FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deal_stage_history
    WHERE deal_id = ANY(v_deal_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_stage_history FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deal_kanban_projection
    WHERE deal_id = ANY(v_deal_ids)
    RETURNING deal_id
  )
  SELECT count(*) INTO v_count_projection FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deal_notes
    WHERE deal_id = ANY(v_deal_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_deal_notes FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deal_pipeline_stages
    WHERE deal_id = ANY(v_deal_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_deal_pipeline_stages FROM deleted;

  WITH deleted AS (
    DELETE FROM public.deals
    WHERE id = ANY(v_deal_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_deals FROM deleted;

  WITH deleted AS (
    DELETE FROM public.projetos
    WHERE id = ANY(v_projeto_ids)
    RETURNING id
  )
  SELECT count(*) INTO v_count_projetos FROM deleted;

  WITH deleted AS (
    DELETE FROM public.external_entity_links
    WHERE tenant_id = p_tenant_id
      AND source = 'solarmarket'
    RETURNING id
  )
  SELECT count(*) INTO v_count_external_links FROM deleted;

  WITH deleted AS (
    DELETE FROM public.clientes
    WHERE tenant_id = p_tenant_id
      AND external_source = 'solarmarket'
    RETURNING id
  )
  SELECT count(*) INTO v_count_clientes FROM deleted;

  v_summary := format(
    'Deletados: %s clientes, %s projetos, %s deals, %s propostas, %s versões, %s kits, %s itens de kit, %s UCs, %s valores customizados de deal, %s históricos de etapa, %s vínculos externos.',
    v_count_clientes,
    v_count_projetos,
    v_count_deals,
    v_count_propostas,
    v_count_versoes,
    v_count_kits,
    v_count_kit_itens,
    v_count_ucs,
    v_count_dcfv,
    v_count_stage_history,
    v_count_external_links
  );

  TRUNCATE TABLE public.sm_projeto_funis_raw;
  TRUNCATE TABLE public.sm_clientes_raw;
  TRUNCATE TABLE public.sm_projetos_raw;
  TRUNCATE TABLE public.sm_propostas_raw;
  TRUNCATE TABLE public.sm_funis_raw;
  TRUNCATE TABLE public.sm_custom_fields_raw;

  RETURN jsonb_build_object(
    'success', true,
    'message', v_summary,
    'counts', jsonb_build_object(
      'clientes', v_count_clientes,
      'projetos', v_count_projetos,
      'deals', v_count_deals,
      'propostas_nativas', v_count_propostas,
      'proposta_versoes', v_count_versoes,
      'proposta_kits', v_count_kits,
      'proposta_kit_itens', v_count_kit_itens,
      'proposta_versao_ucs', v_count_ucs,
      'deal_custom_field_values', v_count_dcfv,
      'deal_stage_history', v_count_stage_history,
      'deal_kanban_projection', v_count_projection,
      'deal_notes', v_count_deal_notes,
      'deal_pipeline_stages', v_count_deal_pipeline_stages,
      'proposta_envios', v_count_proposta_envios,
      'proposta_aceite_tokens', v_count_proposta_aceite_tokens,
      'proposta_cenarios', v_count_proposta_cenarios,
      'proposta_views', v_count_proposta_views,
      'proposta_historico', v_count_proposta_historico,
      'proposal_events', v_count_proposal_events,
      'proposal_followup_queue', v_count_proposal_followup_queue,
      'generated_documents', v_count_generated_documents,
      'external_entity_links', v_count_external_links,
      'sm_raw_tables', 1
    )
  );
END;
$function$;