CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_propostas int := 0;
  v_versoes   int := 0;
  v_projetos  int := 0;
  v_deals     int := 0;
  v_clientes  int := 0;
  v_blocking_op text;
BEGIN
  -- =========================================================
  -- GUARD 1: bloquear operações conflitantes via SSOT
  -- (tabela opcional — pode não existir em todos os ambientes)
  -- =========================================================
  IF to_regclass('public.sm_operation_runs') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT operation_type
      FROM sm_operation_runs
      WHERE tenant_id = $1
        AND status IN ('queued', 'running')
        AND operation_type IN ('migrate_to_native', 'reset_migrated', 'reset_staging')
        AND (heartbeat_at IS NULL OR heartbeat_at > NOW() - INTERVAL '15 minutes'
             OR started_at > NOW() - INTERVAL '15 minutes')
      ORDER BY created_at DESC LIMIT 1
    $sql$ INTO v_blocking_op USING p_tenant_id;

    IF v_blocking_op IS NOT NULL THEN
      RETURN jsonb_build_object('success', false,
        'error', format('Reset bloqueado: operação "%s" em andamento.', v_blocking_op));
    END IF;
  END IF;

  -- =========================================================
  -- GUARD 2: Legacy fallback
  -- =========================================================
  IF to_regclass('public.solar_market_sync_logs') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM solar_market_sync_logs
      WHERE tenant_id = p_tenant_id AND status = 'running'
        AND started_at > NOW() - INTERVAL '15 minutes'
    ) THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Reset bloqueado: sincronização em andamento.');
    END IF;

    UPDATE solar_market_sync_logs
    SET status = 'failed', finished_at = NOW()
    WHERE tenant_id = p_tenant_id AND status = 'running'
      AND started_at <= NOW() - INTERVAL '15 minutes';
  END IF;

  -- =========================================================
  -- Quebrar referências circulares nos registros SM
  -- =========================================================
  UPDATE projetos SET funil_id = NULL, etapa_id = NULL, deal_id = NULL, proposta_id = NULL
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';

  UPDATE deals SET projeto_id = NULL
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';

  UPDATE proposta_versoes SET substituida_por = NULL
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );

  -- Filhos de proposta_versoes (SM)
  DELETE FROM proposta_views WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM proposta_envios WHERE tenant_id = p_tenant_id
    AND versao_id IN (
      SELECT pv.id FROM proposta_versoes pv
      JOIN propostas_nativas pn ON pn.id = pv.proposta_id
      WHERE pn.tenant_id = p_tenant_id AND pn.import_source = 'solar_market'
    );

  DELETE FROM proposta_aceite_tokens WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  DELETE FROM proposta_cenarios WHERE versao_id IN (
    SELECT pv.id FROM proposta_versoes pv
    JOIN propostas_nativas pn ON pn.id = pv.proposta_id
    WHERE pn.tenant_id = p_tenant_id AND pn.import_source = 'solar_market'
  );

  -- proposta_versoes
  DELETE FROM proposta_versoes WHERE proposta_id IN (
    SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- Filhos de propostas_nativas
  DELETE FROM proposal_events WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposal_followup_queue WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposta_historico WHERE tenant_id = p_tenant_id
    AND proposta_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM proposta_grupo_tokens WHERE tenant_id = p_tenant_id
    AND kit_aceito_id IN (SELECT id FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  -- propostas_nativas
  DELETE FROM propostas_nativas WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- Filhos de deals
  DELETE FROM deal_kanban_projection WHERE tenant_id = p_tenant_id
    AND deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');
  DELETE FROM deal_history WHERE tenant_id = p_tenant_id
    AND deal_id IN (SELECT id FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market');

  -- deals
  DELETE FROM deals WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- projetos
  DELETE FROM projetos WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- clientes (somente os criados pela migração SM)
  DELETE FROM clientes WHERE tenant_id = p_tenant_id AND external_source = 'solarmarket';
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'counts', jsonb_build_object(
      'clientes', v_clientes,
      'projetos', v_projetos,
      'deals', v_deals,
      'propostas_nativas', v_propostas,
      'proposta_versoes', v_versoes
    )
  );
END;
$function$;