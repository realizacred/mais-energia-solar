
-- ============================================================
-- FASE 0.1.1-A: BACKFILL CONTROLADO DE tenant_id NULL
-- ============================================================
-- Premissa: Existe exatamente 1 tenant no sistema.
-- Todos os 123 registros órfãos (122 + 1 wa_instances) pertencem a ele.
-- A migration cria auditoria completa para rollback.
-- ============================================================

-- 1) Tabela de auditoria para rastreabilidade e rollback
CREATE TABLE IF NOT EXISTS public.backfill_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_pk UUID NOT NULL,
  tenant_id_old UUID,
  tenant_id_new UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  backfill_batch TEXT NOT NULL DEFAULT 'phase_0_1_1'
);

COMMENT ON TABLE public.backfill_audit IS
  'Registro de alterações de tenant_id para rastreabilidade e rollback. Criada na Fase 0.1.1-A.';

-- RLS: apenas admins
ALTER TABLE public.backfill_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access backfill_audit"
  ON public.backfill_audit FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- 2) Backfill atômico com validação
DO $$
DECLARE
  _target_tenant UUID := '00000000-0000-0000-0000-000000000001';
  _count INTEGER;
  _total INTEGER := 0;
  _table_count INTEGER;
BEGIN
  -- ── Validação: garantir que só existe 1 tenant ──
  SELECT COUNT(*) INTO _count FROM tenants;
  IF _count != 1 THEN
    RAISE EXCEPTION 'ABORTADO: Esperado exatamente 1 tenant, encontrados %. Backfill requer revisão manual.', _count;
  END IF;

  -- ── 2a) wa_instances (CAUSA RAIZ) ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_instances', id, tenant_id, _target_tenant
  FROM wa_instances WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_instances SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_instances: % registros atualizados', _table_count;

  -- ── 2b) wa_webhook_events ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_webhook_events', id, tenant_id, _target_tenant
  FROM wa_webhook_events WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_webhook_events SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_webhook_events: % registros atualizados', _table_count;

  -- ── 2c) wa_quick_replies ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_quick_replies', id, tenant_id, _target_tenant
  FROM wa_quick_replies WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_quick_replies SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_quick_replies: % registros atualizados', _table_count;

  -- ── 2d) wa_outbox ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_outbox', id, tenant_id, _target_tenant
  FROM wa_outbox WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_outbox SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_outbox: % registros atualizados', _table_count;

  -- ── 2e) wa_tags ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_tags', id, tenant_id, _target_tenant
  FROM wa_tags WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_tags SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_tags: % registros atualizados', _table_count;

  -- ── 2f) wa_transfers ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'wa_transfers', id, tenant_id, _target_tenant
  FROM wa_transfers WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE wa_transfers SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_transfers: % registros atualizados', _table_count;

  -- ── 2g) site_servicos ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'site_servicos', id, tenant_id, _target_tenant
  FROM site_servicos WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE site_servicos SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'site_servicos: % registros atualizados', _table_count;

  -- ── 2h) solar_market_sync_logs ──
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new)
  SELECT 'solar_market_sync_logs', id, tenant_id, _target_tenant
  FROM solar_market_sync_logs WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  
  UPDATE solar_market_sync_logs SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'solar_market_sync_logs: % registros atualizados', _table_count;

  RAISE NOTICE '✅ Backfill completo. Total: % registros auditados.', _total;
END $$;
