
-- Fix reset_migrated_data RPC: add 15-minute staleness check to GUARD 2 (solar_market_sync_logs)
-- Also clean up currently stale running sync logs

-- 1. Clean up stale sync logs (running for > 15 min without finishing)
UPDATE solar_market_sync_logs
SET status = 'failed', finished_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '15 minutes';

-- 2. Fix the RPC to include staleness check in GUARD 2
CREATE OR REPLACE FUNCTION reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_propostas int;
  v_versoes int;
  v_projetos int;
  v_deals int;
  v_clientes int;
  v_active_sync int;
  v_has_active boolean;
BEGIN
  -- GUARD 1: Check SSOT for any active SM operation
  SELECT has_active_sm_operation(p_tenant_id) INTO v_has_active;

  IF v_has_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reset bloqueado: existe operação SolarMarket em andamento. Aguarde a conclusão.'
    );
  END IF;

  -- GUARD 2: Legacy fallback — check solar_market_sync_logs for running syncs
  -- Added 15-minute staleness window to prevent orphaned logs from blocking forever
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
$$;
