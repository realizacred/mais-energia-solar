
-- ═══ LIMPEZA: Deletar registros canônicos migrados do SM para re-importação ═══

-- 1. Delete proposta_versoes (none exist, but safety)
DELETE FROM proposta_versoes WHERE proposta_id IN (
  SELECT id FROM propostas_nativas WHERE origem = 'imported'
);

-- 2. Delete propostas_nativas imported
DELETE FROM propostas_nativas WHERE origem = 'imported';

-- 3. Delete projetos linked to SM deals
DELETE FROM projetos WHERE deal_id IN (
  SELECT id FROM deals WHERE legacy_key LIKE 'sm:%'
);

-- 4. Delete SM deals
DELETE FROM deals WHERE legacy_key LIKE 'sm:%';

-- 5. Delete client created by migration (Gabriel Martins - created at same time as migration)
DELETE FROM clientes WHERE id = '7e681e9e-674a-419a-bbb1-24fe69700dc1';

-- 6. Reset all_funnels enrichment flags so sync re-processes ALL projects
-- This forces the sync to re-fetch funnels for all 1807 projects
UPDATE solar_market_projects 
SET sm_funnel_id = NULL, 
    sm_stage_id = NULL,
    sm_funnel_name = NULL, 
    sm_stage_name = NULL,
    all_funnels = NULL
WHERE tenant_id IS NOT NULL;
