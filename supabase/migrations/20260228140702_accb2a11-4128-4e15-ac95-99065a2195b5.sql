-- Limpar dados migrados do SolarMarket (teste)
-- Ordem corrigida respeitando FKs

-- 1. Versões de proposta
DELETE FROM proposta_versoes WHERE proposta_id IN (
  SELECT id FROM propostas_nativas WHERE sm_id IS NOT NULL
);

-- 2. Propostas nativas importadas
DELETE FROM propostas_nativas WHERE sm_id IS NOT NULL;

-- 3. Projetos vinculados a clientes SM (antes de deals por FK)
DELETE FROM projetos WHERE cliente_id IN (
  SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%'
);

-- 4. Deals importados
DELETE FROM deals WHERE legacy_key LIKE 'sm:%';

-- 5. Clientes SM
DELETE FROM clientes WHERE cliente_code LIKE 'SM-%';