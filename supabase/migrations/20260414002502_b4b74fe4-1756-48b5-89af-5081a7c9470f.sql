
-- ═══════════════════════════════════════════════════════
-- FIX: Correct SM migration pipeline/stage assignments
-- ═══════════════════════════════════════════════════════

-- Pipeline IDs
-- Comercial:   988a6ce8-c8e5-43d8-8f49-57aad2f7d794
-- Compesação:  251d54da-e373-4b37-acdd-2bc640b13d31
-- Engenharia:  ca10732d-aa12-4d23-bc01-c0f5aa9f3bee
-- Equipamento: ca6692f4-102f-47d2-8612-042c9ec6c1a8

-- Stage IDs (Comercial)
-- Recebido:         3159305c-5673-43b7-a7cb-1ee3fb27621b
-- Enviar Proposta:  a2d14214-cdc0-464f-85be-a60889ead819
-- Proposta enviada: 9e329f1b-5fe0-4e5a-9d82-4a38a186975a
-- Fechado:          2a2732d0-94e6-4d46-8870-1266b2dc8f83

-- Stage IDs (Equipamento)
-- Sistema em Operação: bb1cfcc5-af9f-4f59-9887-267d79332159

-- Stage IDs (Compesação)
-- Compesação aceita: 274d7f02-ce04-48ea-b310-aa9ac74904e8

-- ─── Step 1: Fix Vendedores/NULL funnel deals stuck in Compesação ───
-- Move to Comercial pipeline with stage based on best proposal status

-- 1a: Deals with approved proposals → Comercial/Fechado
UPDATE deals d
SET 
  pipeline_id = '988a6ce8-c8e5-43d8-8f49-57aad2f7d794',
  stage_id = '2a2732d0-94e6-4d46-8870-1266b2dc8f83'
WHERE d.import_source = 'solar_market'
  AND d.pipeline_id = '251d54da-e373-4b37-acdd-2bc640b13d31'
  AND d.stage_id = 'e65e3df0-fa95-4bf4-8bcf-9140e0e1529f'
  AND EXISTS (
    SELECT 1 FROM solar_market_projects sp
    WHERE 'sm:' || sp.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND (sp.sm_funnel_name = 'Vendedores' OR sp.sm_funnel_name IS NULL)
  )
  AND EXISTS (
    SELECT 1 FROM solar_market_proposals smp
    JOIN solar_market_projects sp2 ON sp2.sm_project_id = smp.sm_project_id
    WHERE 'sm:' || sp2.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND smp.status = 'approved'
  );

-- 1b: Deals with generated/viewed proposals → Comercial/Proposta enviada
UPDATE deals d
SET 
  pipeline_id = '988a6ce8-c8e5-43d8-8f49-57aad2f7d794',
  stage_id = '9e329f1b-5fe0-4e5a-9d82-4a38a186975a'
WHERE d.import_source = 'solar_market'
  AND d.pipeline_id = '251d54da-e373-4b37-acdd-2bc640b13d31'
  AND d.stage_id = 'e65e3df0-fa95-4bf4-8bcf-9140e0e1529f'
  AND EXISTS (
    SELECT 1 FROM solar_market_projects sp
    WHERE 'sm:' || sp.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND (sp.sm_funnel_name = 'Vendedores' OR sp.sm_funnel_name IS NULL)
  )
  AND EXISTS (
    SELECT 1 FROM solar_market_proposals smp
    JOIN solar_market_projects sp2 ON sp2.sm_project_id = smp.sm_project_id
    WHERE 'sm:' || sp2.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND smp.status IN ('generated', 'viewed', 'sent')
  );

-- 1c: Remaining deals still in Compesação/Recebido from Vendedores/NULL → Comercial/Recebido
UPDATE deals d
SET 
  pipeline_id = '988a6ce8-c8e5-43d8-8f49-57aad2f7d794',
  stage_id = '3159305c-5673-43b7-a7cb-1ee3fb27621b'
WHERE d.import_source = 'solar_market'
  AND d.pipeline_id = '251d54da-e373-4b37-acdd-2bc640b13d31'
  AND d.stage_id = 'e65e3df0-fa95-4bf4-8bcf-9140e0e1529f'
  AND EXISTS (
    SELECT 1 FROM solar_market_projects sp
    WHERE 'sm:' || sp.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND (sp.sm_funnel_name = 'Vendedores' OR sp.sm_funnel_name IS NULL)
  );

-- ─── Step 2: Fix Equipamento funnel deals in wrong pipeline ───
UPDATE deals d
SET 
  pipeline_id = 'ca6692f4-102f-47d2-8612-042c9ec6c1a8',
  stage_id = 'bb1cfcc5-af9f-4f59-9887-267d79332159'
WHERE d.import_source = 'solar_market'
  AND d.pipeline_id != 'ca6692f4-102f-47d2-8612-042c9ec6c1a8'
  AND EXISTS (
    SELECT 1 FROM solar_market_projects sp
    WHERE 'sm:' || sp.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND sp.sm_funnel_name = 'Equipamento'
  );

-- ─── Step 3: Fix Compesação funnel deals in wrong pipeline ───
UPDATE deals d
SET 
  pipeline_id = '251d54da-e373-4b37-acdd-2bc640b13d31',
  stage_id = '274d7f02-ce04-48ea-b310-aa9ac74904e8'
WHERE d.import_source = 'solar_market'
  AND d.pipeline_id != '251d54da-e373-4b37-acdd-2bc640b13d31'
  AND EXISTS (
    SELECT 1 FROM solar_market_projects sp
    WHERE 'sm:' || sp.sm_project_id || ':' || split_part(d.legacy_key, ':', 3) = d.legacy_key
      AND sp.sm_funnel_name = 'Compesação'
  );
