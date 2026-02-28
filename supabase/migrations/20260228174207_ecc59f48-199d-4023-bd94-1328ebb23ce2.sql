
-- ============================================================
-- CLEANUP: Remove migrated SM data + reset custom_fields_raw
-- ============================================================

-- 1) Delete proposta_versoes for imported propostas
DELETE FROM proposta_versoes 
WHERE proposta_id IN (
  SELECT id FROM propostas_nativas WHERE origem = 'imported'
);

-- 2) Delete imported propostas_nativas
DELETE FROM propostas_nativas WHERE origem = 'imported';

-- 3) Delete projetos linked to SM clients
DELETE FROM projetos 
WHERE cliente_id IN (
  SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%'
);

-- 4) Delete deals linked to SM clients
DELETE FROM deals 
WHERE customer_id IN (
  SELECT id FROM clientes WHERE cliente_code LIKE 'SM-%'
);

-- 5) Delete SM clients
DELETE FROM clientes WHERE cliente_code LIKE 'SM-%';

-- 6) Reset custom_fields_raw on SM proposals for re-backfill
UPDATE solar_market_proposals 
SET custom_fields_raw = NULL 
WHERE custom_fields_raw IS NOT NULL;
