
-- =============================================================================
-- SSOT table for SolarMarket operations state
-- =============================================================================

CREATE TABLE public.sm_operation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'solar_market',
  operation_type text NOT NULL,  -- sync_staging, sync_proposals, migrate_to_native, reset_staging, reset_migrated, reset_tenant
  status text NOT NULL DEFAULT 'queued',  -- queued, running, completed, failed, cancelled
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz,
  created_by uuid,
  total_items int DEFAULT 0,
  processed_items int DEFAULT 0,
  success_items int DEFAULT 0,
  error_items int DEFAULT 0,
  skipped_items int DEFAULT 0,
  checkpoint_json jsonb DEFAULT '{}'::jsonb,
  context_json jsonb DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sm_operation_runs_status_check CHECK (status IN ('queued','running','completed','failed','cancelled')),
  CONSTRAINT sm_operation_runs_type_check CHECK (operation_type IN (
    'sync_staging','sync_proposals','sync_funnels',
    'migrate_to_native',
    'reset_staging','reset_migrated','reset_tenant'
  ))
);

-- Index for "is there an active operation?" queries
CREATE INDEX idx_sm_operation_runs_active
  ON public.sm_operation_runs(tenant_id, status)
  WHERE status IN ('queued','running');

-- Index for history queries
CREATE INDEX idx_sm_operation_runs_tenant_created
  ON public.sm_operation_runs(tenant_id, created_at DESC);

-- Auto-expire stale runs (heartbeat older than 10 min while still "running")
-- This is a safety net, not a primary mechanism
COMMENT ON TABLE public.sm_operation_runs IS 'SSOT for SolarMarket sync/migration/reset operations. Replaces temporal heuristics.';

-- RLS
ALTER TABLE public.sm_operation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant runs"
  ON public.sm_operation_runs FOR SELECT
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can insert own tenant runs"
  ON public.sm_operation_runs FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "Users can update own tenant runs"
  ON public.sm_operation_runs FOR UPDATE
  TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass (implicit, but explicit for clarity)
CREATE POLICY "Service role full access"
  ON public.sm_operation_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- Helper: check if active SM operation exists
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_active_sm_operation(
  p_tenant_id uuid,
  p_operation_types text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sm_operation_runs
    WHERE tenant_id = p_tenant_id
      AND status IN ('queued', 'running')
      AND (p_operation_types IS NULL OR operation_type = ANY(p_operation_types))
      -- Safety: ignore stale runs with no heartbeat for 15+ min
      AND (
        heartbeat_at IS NULL
        OR heartbeat_at > NOW() - INTERVAL '15 minutes'
      )
      -- Also consider started_at for runs that never got a heartbeat
      AND (
        heartbeat_at IS NOT NULL
        OR started_at IS NULL
        OR started_at > NOW() - INTERVAL '15 minutes'
      )
  )
$$;

-- =============================================================================
-- Update reset_migrated_data to use SSOT instead of 10-min heuristic
-- =============================================================================

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

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sm_operation_runs;
