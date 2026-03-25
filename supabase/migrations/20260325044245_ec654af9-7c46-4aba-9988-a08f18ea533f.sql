-- Backfill geracao_mensal from snapshot.tecnico.geracao_estimada_kwh for version 2+
UPDATE proposta_versoes 
SET geracao_mensal = (snapshot->'tecnico'->>'geracao_estimada_kwh')::numeric
WHERE geracao_mensal IS NULL 
  AND status = 'generated'
  AND snapshot->'tecnico'->>'geracao_estimada_kwh' IS NOT NULL;