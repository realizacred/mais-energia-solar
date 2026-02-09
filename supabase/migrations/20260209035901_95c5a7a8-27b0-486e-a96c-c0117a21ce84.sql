
-- ============================================================
-- FASE 0.1.1-A SUPLEMENTAR: BACKFILL ADICIONAL (34 registros)
-- ============================================================
-- Registros que não foram detectados no scan inicial.
-- Mesma lógica: 1 tenant, inferência segura.
-- ============================================================

DO $$
DECLARE
  _target_tenant UUID := '00000000-0000-0000-0000-000000000001';
  _count INTEGER;
  _table_count INTEGER;
  _total INTEGER := 0;
BEGIN
  -- Validação
  SELECT COUNT(*) INTO _count FROM tenants;
  IF _count != 1 THEN
    RAISE EXCEPTION 'ABORTADO: Esperado 1 tenant, encontrados %', _count;
  END IF;

  -- wa_messages (28)
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new, backfill_batch)
  SELECT 'wa_messages', id, tenant_id, _target_tenant, 'phase_0_1_1_extra'
  FROM wa_messages WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  UPDATE wa_messages SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_messages: % registros', _table_count;

  -- wa_conversations (3)
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new, backfill_batch)
  SELECT 'wa_conversations', id, tenant_id, _target_tenant, 'phase_0_1_1_extra'
  FROM wa_conversations WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  UPDATE wa_conversations SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'wa_conversations: % registros', _table_count;

  -- inversores (1)
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new, backfill_batch)
  SELECT 'inversores', id, tenant_id, _target_tenant, 'phase_0_1_1_extra'
  FROM inversores WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  UPDATE inversores SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'inversores: % registros', _table_count;

  -- baterias (1)
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new, backfill_batch)
  SELECT 'baterias', id, tenant_id, _target_tenant, 'phase_0_1_1_extra'
  FROM baterias WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  UPDATE baterias SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'baterias: % registros', _table_count;

  -- modulos_fotovoltaicos (1)
  INSERT INTO backfill_audit (table_name, row_pk, tenant_id_old, tenant_id_new, backfill_batch)
  SELECT 'modulos_fotovoltaicos', id, tenant_id, _target_tenant, 'phase_0_1_1_extra'
  FROM modulos_fotovoltaicos WHERE tenant_id IS NULL;
  GET DIAGNOSTICS _table_count = ROW_COUNT;
  UPDATE modulos_fotovoltaicos SET tenant_id = _target_tenant WHERE tenant_id IS NULL;
  _total := _total + _table_count;
  RAISE NOTICE 'modulos_fotovoltaicos: % registros', _table_count;

  RAISE NOTICE '✅ Backfill extra completo. Total: % registros', _total;
END $$;
