-- Backfill geracao_mensal from snapshot for existing generated versions
UPDATE proposta_versoes 
SET geracao_mensal = COALESCE(
  (snapshot->>'geracao_estimada')::numeric,
  (snapshot->>'geracaoMensalEstimada')::numeric,
  (snapshot->>'geracao_mensal_estimada')::numeric
)
WHERE geracao_mensal IS NULL 
  AND status = 'generated'
  AND (
    (snapshot->>'geracao_estimada') IS NOT NULL 
    OR (snapshot->>'geracaoMensalEstimada') IS NOT NULL
    OR (snapshot->>'geracao_mensal_estimada') IS NOT NULL
  );