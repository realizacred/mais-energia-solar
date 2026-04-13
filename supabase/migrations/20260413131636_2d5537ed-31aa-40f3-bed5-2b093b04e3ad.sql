
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_propostas int;
  v_versoes int;
  v_projetos int;
  v_deals int;
  v_clientes int;
  v_active_sync int;
  v_blocking_op text;
BEGIN
  -- GUARD 1: Check SSOT for active MIGRATION operations only
  -- Sync operations (sync_proposals, sync_projects, etc.) do NOT conflict with reset
  SELECT operation_type INTO v_blocking_op
  FROM sm_operation_runs
  WHERE tenant_id = p_tenant_id
    AND status IN ('queued', 'running')
    AND operation_type IN ('migrate_to_native', 'reset_staging', 'reset_migrated')
    AND (
      heartbeat_at IS NULL
      OR heartbeat_at > NOW() - INTERVAL '15 minutes'
    )
    AND (
      heartbeat_at IS NOT NULL
      OR started_at IS NULL
      OR started_at > NOW() - INTERVAL '15 minutes'
    )
  LIMIT 1;

  IF v_blocking_op IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Reset bloqueado: operação "%s" em andamento. Aguarde a conclusão.', v_blocking_op)
    );
  END IF;

  -- GUARD 2: Legacy fallback — check solar_market_sync_logs for running syncs
  SELECT COUNT(*) INTO v_active_sync
  FROM solar_market_sync_logs
  WHERE tenant_id = p_tenant_id
    AND status = 'running'
    AND started_at > NOW() - INTERVAL '15 minutes';

  IF v_active_sync > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reset bloqueado: existe sincronização SolarMarket em andamento.',
      'active_syncs', v_active_sync
    );
  END IF;

  -- Mark any remaining stale running sync logs as failed before proceeding
  UPDATE solar_market_sync_logs
  SET status = 'failed', finished_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND status = 'running'
    AND started_at <= NOW() - INTERVAL '15 minutes';

  -- Delete proposta_versoes of SM-imported propostas
  DELETE FROM proposta_versoes
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas
    WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  DELETE FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  DELETE FROM deals
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  DELETE FROM projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  DELETE FROM clientes
  WHERE tenant_id = p_tenant_id
    AND import_source = 'solar_market'
    AND NOT EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.cliente_id = clientes.id AND p.import_source IS NULL
    );
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  UPDATE solar_market_proposals SET migrado_em = NULL WHERE tenant_id = p_tenant_id;
  UPDATE solar_market_projects SET migrado_em = NULL WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'propostas_nativas', v_propostas,
    'proposta_versoes', v_versoes,
    'projetos', v_projetos,
    'deals', v_deals,
    'clientes', v_clientes
  );
END;
$function$;
