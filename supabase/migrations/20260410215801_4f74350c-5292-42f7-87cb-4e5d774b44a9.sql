
-- ============================================================
-- Step 1: Fix deals with secondary funnels → move to "Ganho" in Comercial
-- These are deals that progressed beyond the commercial pipeline in SM
-- ============================================================
UPDATE deals d
SET 
  stage_id = '80169d0d-0545-451c-a74f-8925fbf44e75', -- Ganho
  updated_at = NOW()
FROM solar_market_proposals smp
JOIN solar_market_projects smproj ON smproj.sm_project_id = smp.sm_project_id
WHERE d.legacy_key LIKE 'sm:%'
  AND smp.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
  AND smp.sm_proposal_id = CAST(split_part(d.legacy_key, ':', 3) AS integer)
  AND d.stage_id = '9ca9757b-f710-4143-8a7a-2f9e1c6b2f7a' -- currently in Recebido
  AND smproj.all_funnels IS NOT NULL
  AND smproj.all_funnels::text ~ '"funnelName"\s*:\s*"(Engenharia|Equipamento|Compesação|Pagamento)"';

-- ============================================================
-- Step 2: Fix remaining deals with SM status=generated → "Proposta Enviada"
-- ============================================================
UPDATE deals d
SET 
  stage_id = 'eead8fb1-8f61-4e01-b931-c73872f9cce2', -- Proposta Enviada
  updated_at = NOW()
FROM solar_market_proposals smp
WHERE d.legacy_key LIKE 'sm:%'
  AND smp.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
  AND smp.sm_proposal_id = CAST(split_part(d.legacy_key, ':', 3) AS integer)
  AND d.stage_id = '9ca9757b-f710-4143-8a7a-2f9e1c6b2f7a' -- still in Recebido
  AND smp.status = 'generated';

-- ============================================================
-- Step 3: Fix remaining deals with SM status=created → "Qualificação"
-- ============================================================
UPDATE deals d
SET 
  stage_id = '17f8dc4b-2aec-4c41-a919-d6dbd162ad7b', -- Qualificação
  updated_at = NOW()
FROM solar_market_proposals smp
WHERE d.legacy_key LIKE 'sm:%'
  AND smp.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
  AND smp.sm_proposal_id = CAST(split_part(d.legacy_key, ':', 3) AS integer)
  AND d.stage_id = '9ca9757b-f710-4143-8a7a-2f9e1c6b2f7a' -- still in Recebido
  AND smp.status = 'created';

-- ============================================================
-- Step 4: Create deal_pipeline_stages for secondary funnels
-- Map SM funnel stages to native pipeline stages
-- ============================================================

-- Engenharia pipeline stages
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT DISTINCT
  d.id,
  '86a5c092-4651-46aa-936a-74eadcddddc2'::uuid, -- Engenharia
  CASE f->>'stageName'
    WHEN 'Projetos Aprovados' THEN '991709e9-e71e-497b-8712-3e7a19aa239f'
    WHEN 'Etapa de Obra' THEN '477e7010-3dc4-40fa-9ff9-e116c70e729b'
    WHEN 'Falta Documentos' THEN 'e08d76fa-9645-46b3-a2aa-ff2ab18ba716'
    WHEN 'Finalizado' THEN 'dd30be96-98f2-4518-bc35-5249f7d79c31'
    WHEN 'Vistoria' THEN 'dae35528-95a9-467f-88de-0fda56a5ed95'
    WHEN 'Elaboração do Projeto' THEN 'db9e01e4-d83c-47d4-a648-bbb923ccbf05'
    WHEN 'Pagamento TRT' THEN '2dd436e7-6dc0-45b0-9d95-d93193953992'
    WHEN 'Projeto Enviado' THEN 'cff425e3-2cd1-4da0-b0f2-ae91bf9d3266'
  END::uuid,
  '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
FROM deals d
JOIN solar_market_projects smproj ON smproj.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
CROSS JOIN jsonb_array_elements(smproj.all_funnels::jsonb) f
WHERE d.legacy_key LIKE 'sm:%'
  AND f->>'funnelName' = 'Engenharia'
ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = NOW();

-- Equipamento pipeline stages
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT DISTINCT
  d.id,
  '4343642f-aa5f-4638-9b0b-0cc492165a4b'::uuid, -- Equipamento
  CASE f->>'stageName'
    WHEN 'Em Andamento' THEN '5bd3a0e3-030f-4d25-9ed5-8763d6e1594d'
    WHEN 'Deposito' THEN 'd85818d2-f6d8-4d54-9fb6-307163cdfbe1'
    WHEN 'Instalação Realizada' THEN 'fefa8015-ec76-4f56-b9d1-c1753e771479'
    WHEN 'Sistema em Operação' THEN '44029d43-71d8-4bc9-b090-89a83947ca6b'
    WHEN 'Pedido Efetuado' THEN '1d2c9b1d-93fd-4ad1-8361-1938fb53890e'
    WHEN 'Fazer Pedido' THEN 'd3e26115-d125-424f-833e-3d63474731dd'
    WHEN 'Pedido Pago' THEN '09432324-07ce-4b7d-be3c-cf505bc99b3d'
    WHEN 'Cliente' THEN 'f43fddc3-306a-4897-9eda-6a2ffa5b7f7b'
  END::uuid,
  '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
FROM deals d
JOIN solar_market_projects smproj ON smproj.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
CROSS JOIN jsonb_array_elements(smproj.all_funnels::jsonb) f
WHERE d.legacy_key LIKE 'sm:%'
  AND f->>'funnelName' = 'Equipamento'
ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = NOW();

-- Compensação pipeline stages
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT DISTINCT
  d.id,
  '251d54da-e373-4b37-acdd-2bc640b13d31'::uuid, -- Compesação
  CASE f->>'stageName'
    WHEN 'Recebido' THEN 'e65e3df0-fa95-4bf4-8bcf-9140e0e1529f'
    WHEN 'Compesação aceita' THEN '274d7f02-ce04-48ea-b310-aa9ac74904e8'
    WHEN 'Compesação enviada' THEN 'a64e2798-861f-4c20-b634-b1782b1aff34'
  END::uuid,
  '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
FROM deals d
JOIN solar_market_projects smproj ON smproj.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
CROSS JOIN jsonb_array_elements(smproj.all_funnels::jsonb) f
WHERE d.legacy_key LIKE 'sm:%'
  AND f->>'funnelName' = 'Compesação'
ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = NOW();

-- Pagamento pipeline stages
INSERT INTO deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT DISTINCT
  d.id,
  '1e39a89a-3e70-4f4a-9ecc-7aa184581dfc'::uuid, -- Pagamento
  CASE f->>'stageName'
    WHEN 'Não Pago' THEN 'd4c4e217-1894-413e-a5e0-ce50f8f75c3b'
    WHEN 'Pago' THEN '76ffadeb-1d69-4dd8-bbc4-0a713c93b199'
  END::uuid,
  '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
FROM deals d
JOIN solar_market_projects smproj ON smproj.sm_project_id = CAST(split_part(d.legacy_key, ':', 2) AS integer)
CROSS JOIN jsonb_array_elements(smproj.all_funnels::jsonb) f
WHERE d.legacy_key LIKE 'sm:%'
  AND f->>'funnelName' = 'Pagamento'
ON CONFLICT (deal_id, pipeline_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = NOW();
