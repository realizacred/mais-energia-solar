-- Limpeza de dados promovidos incorretamente do SolarMarket (tenant 17de8315...)
-- Mantém staging (sm_*_raw) e configurações intactos.

BEGIN;

-- 1. Apagar vínculos canônicos SM
DELETE FROM external_entity_links
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND source IN ('solarmarket', 'solar_market');

-- 2. Apagar propostas nativas de origem SM (defensivo, deve ser 0)
DELETE FROM propostas_nativas
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market')
       OR origem IN ('solarmarket', 'solar_market'));

-- 3. Apagar projetos de origem SM
DELETE FROM projetos
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market')
       OR origem IN ('solarmarket', 'solar_market')
       OR codigo LIKE 'SM-PROJ-%');

-- 4. Apagar clientes de origem SM (somente se órfãos de projetos)
DELETE FROM clientes
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND (external_source IN ('solarmarket', 'solar_market')
       OR origem IN ('solarmarket', 'solar_market'))
  AND NOT EXISTS (SELECT 1 FROM projetos p WHERE p.cliente_id = clientes.id);

COMMIT;