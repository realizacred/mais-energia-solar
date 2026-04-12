
-- Add import_source to key native tables
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS import_source text;
ALTER TABLE public.propostas_nativas ADD COLUMN IF NOT EXISTS import_source text;

-- Create indexes for efficient reset queries
CREATE INDEX IF NOT EXISTS idx_clientes_import_source ON public.clientes(tenant_id, import_source) WHERE import_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_import_source ON public.deals(tenant_id, import_source) WHERE import_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projetos_import_source ON public.projetos(tenant_id, import_source) WHERE import_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_propostas_nativas_import_source ON public.propostas_nativas(tenant_id, import_source) WHERE import_source IS NOT NULL;

-- Backfill existing SM-migrated records
UPDATE public.propostas_nativas SET import_source = 'solar_market' WHERE import_source IS NULL AND origem = 'imported' AND sm_id IS NOT NULL;
UPDATE public.clientes SET import_source = 'solar_market' WHERE import_source IS NULL AND origem = 'imported' AND cliente_code LIKE 'SM-%';
UPDATE public.deals SET import_source = 'solar_market' WHERE import_source IS NULL AND origem = 'imported';
UPDATE public.projetos SET import_source = 'solar_market' WHERE import_source IS NULL AND origem = 'imported';

-- Harden reset_migrated_data to use import_source instead of generic origem
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
  v_recebimentos int;
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
      'error', 'Reset bloqueado: existe migração SolarMarket em andamento (atividade nos últimos 10 min).',
      'recent_migrations', v_recent_migration
    );
  END IF;

  -- Delete proposta_versoes of SM-imported propostas (using import_source)
  DELETE FROM proposta_versoes
  WHERE proposta_id IN (
    SELECT id FROM propostas_nativas
    WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
  );
  GET DIAGNOSTICS v_versoes = ROW_COUNT;

  -- Delete SM-imported propostas
  DELETE FROM propostas_nativas
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_propostas = ROW_COUNT;

  -- Delete SM-imported deals
  DELETE FROM deals
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_deals = ROW_COUNT;

  -- Delete SM-imported projetos
  DELETE FROM projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';
  GET DIAGNOSTICS v_projetos = ROW_COUNT;

  -- Delete SM-imported clientes that have no native projetos
  DELETE FROM clientes
  WHERE tenant_id = p_tenant_id
    AND import_source = 'solar_market'
    AND NOT EXISTS (
      SELECT 1 FROM projetos p
      WHERE p.cliente_id = clientes.id AND p.import_source IS NULL
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
