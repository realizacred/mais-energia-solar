-- Clean up orphan deals from client "Teste"
-- Deal caef71b6 has proposta_nativa -> proposta_versoes chain

-- 1. Delete proposta version
DELETE FROM proposta_versoes WHERE proposta_id = '9029ffca-8fc9-4996-a190-e9483272e9f6';

-- 2. Delete proposta nativa
DELETE FROM propostas_nativas WHERE id = '9029ffca-8fc9-4996-a190-e9483272e9f6';

-- 3. Delete both orphan deals
DELETE FROM deals 
WHERE id IN (
  'caad2b97-164f-4ea0-9074-216316c7ab92',
  'caef71b6-cf6c-414a-8365-b7bea568dac8'
)
AND projeto_id IS NULL;