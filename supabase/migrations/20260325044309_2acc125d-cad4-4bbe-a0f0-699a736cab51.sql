-- Backfill economia_mensal from snapshot.financeiro.economia_mensal for versions missing it
UPDATE proposta_versoes 
SET economia_mensal = (snapshot->'financeiro'->>'economia_mensal')::numeric
WHERE economia_mensal IS NULL 
  AND status = 'generated'
  AND snapshot->'financeiro'->>'economia_mensal' IS NOT NULL;