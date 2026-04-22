BEGIN;

-- Staging
DELETE FROM sm_clientes_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_projetos_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_propostas_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_funis_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_custom_fields_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM sm_projeto_funis_raw WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Histórico jobs/logs
DELETE FROM solarmarket_import_logs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM solarmarket_import_jobs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM solarmarket_promotion_logs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';
DELETE FROM solarmarket_promotion_jobs WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Mapeamentos
DELETE FROM sm_consultor_mapping WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41';

-- Vínculos externos SM
DELETE FROM external_entity_links 
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND source IN ('solarmarket', 'solar_market');

-- Canônicos SM remanescentes
DELETE FROM propostas_nativas
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market') 
       OR origem IN ('solarmarket', 'solar_market'));

DELETE FROM projetos
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market') 
       OR origem IN ('solarmarket', 'solar_market')
       OR codigo LIKE 'SM-PROJ-%');

DELETE FROM clientes
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market') 
       OR origem IN ('solarmarket', 'solar_market'))
  AND NOT EXISTS (
    SELECT 1 FROM projetos p WHERE p.cliente_id = clientes.id
  );

-- Pipelines auto-criados vazios (apagar stages primeiro)
WITH pipelines_a_remover AS (
  SELECT p.id
  FROM pipelines p
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
    AND p.name IN ('Vendedores', 'LEAD', 'Engenharia', 'Compesação', 'Equipamento', 'Pagamento')
    AND NOT EXISTS (SELECT 1 FROM projetos pr WHERE pr.funil_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.pipeline_id = p.id)
)
DELETE FROM pipeline_stages
WHERE pipeline_id IN (SELECT id FROM pipelines_a_remover);

DELETE FROM pipelines
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND name IN ('Vendedores', 'LEAD', 'Engenharia', 'Compesação', 'Equipamento', 'Pagamento')
  AND NOT EXISTS (SELECT 1 FROM projetos pr WHERE pr.funil_id = pipelines.id)
  AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.pipeline_id = pipelines.id);

COMMIT;