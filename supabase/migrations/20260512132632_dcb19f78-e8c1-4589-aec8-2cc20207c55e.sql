UPDATE proposta_versoes
SET payback_meses = CASE
  WHEN economia_mensal IS NULL OR economia_mensal <= 0 THEN NULL
  WHEN valor_total IS NULL OR valor_total <= 0 THEN NULL
  ELSE CEIL(valor_total::numeric / economia_mensal::numeric)::int
END
WHERE
  (economia_mensal IS NOT NULL AND economia_mensal > 0
   AND valor_total IS NOT NULL AND valor_total > 0
   AND payback_meses IS DISTINCT FROM CEIL(valor_total::numeric / economia_mensal::numeric)::int)
  OR
  ((economia_mensal IS NULL OR economia_mensal <= 0 OR valor_total IS NULL OR valor_total <= 0)
   AND payback_meses IS NOT NULL);