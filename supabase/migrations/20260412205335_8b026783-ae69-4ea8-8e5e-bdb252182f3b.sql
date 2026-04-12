
CREATE OR REPLACE FUNCTION public.reset_migrated_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_propostas int;
  v_versoes int;
  v_projetos int;
  v_deals int;
  v_clientes int;
  v_active_sync int;
  v_recent_migration int;
BEGIN
  -- GUARD: Check for active SolarMarket sync
  SELECT COUNT(*) INTO v_active_sync
  FROM solar_market_sync_logs
  WHERE tenant_id = p_tenant_id AND status = 'running';

  IF v_active_sync > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reset bloqueado: existe sincronização SolarMarket em andamento.',
      'active_syncs', v_active_sync
    );
  END IF;

  -- GUARD: Check for recent migration activity (last 10 minutes)
  SELECT COUNT(*) INTO v_recent_migration
  FROM sm_migration_log
  WHERE tenant_id = p_tenant_id
    AND created_at > NOW() - INTERVAL '10 minutes'
    AND status IN ('SUCCESS', 'CREATED', 'SKIP');

  IF v_recent_migration > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Reset bloqueado: existe migração de propostas SolarMarket em andamento (atividade nos últimos 10 min).',
      'recent_migrations', v_recent_migration
    );
  END IF;

  -- Delete proposta_versoes of imported propostas
  DELETE FROM proposta_versoes
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas
    WHERE tenant_id = p_tenant_id AND origem = 'imported'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- Delete imported propostas
  DELETE FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- Delete imported deals
  DELETE FROM deals
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- Delete imported projetos
  DELETE FROM projetos
  WHERE tenant_id = p_tenant_id AND origem = 'imported';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- Delete imported clientes that have no native projetos
  DELETE FROM clientes
  WHERE tenant_id = p_tenant_id
    AND origem = 'imported'
    AND NOT EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.cliente_id = clientes.id AND p.origem = 'native'
    );
  GET DIAGNOSTICS v_clientes = ROW_COUNT;

  -- Reset SM migration flags
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
