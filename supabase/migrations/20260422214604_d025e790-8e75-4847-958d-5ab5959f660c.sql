-- Limpeza completa do staging e histórico SolarMarket para tenant 17de8315-2e2f-4a79-8751-e5d507d69a41
-- Preserva: consultores, pipelines, pipeline_stages, tenants, usuarios

BEGIN;

-- Staging
DELETE FROM sm_clientes_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_projetos_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_propostas_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_funis_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_projeto_funis_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_custom_fields_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Histórico de jobs/logs
DELETE FROM solarmarket_import_logs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM solarmarket_import_jobs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Jobs de promoção (por garantia)
DELETE FROM solarmarket_promotion_logs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM solarmarket_promotion_jobs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Mapeamentos de consultor SM
DELETE FROM sm_consultor_mapping WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Vínculos externos SM
DELETE FROM external_entity_links 
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND source IN ('solarmarket', 'solar_market');

COMMIT;