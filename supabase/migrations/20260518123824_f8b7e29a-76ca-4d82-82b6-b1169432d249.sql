UPDATE proposta_versoes pv
SET consumo_mensal = sub.total_consumo
FROM (
  SELECT versao_id, SUM(consumo_mensal_kwh) AS total_consumo
  FROM proposta_versao_ucs
  WHERE consumo_mensal_kwh IS NOT NULL
  GROUP BY versao_id
) sub
WHERE pv.id = sub.versao_id AND pv.consumo_mensal IS NULL AND sub.total_consumo > 0;

UPDATE proposta_versoes pv
SET tarifa_distribuidora = sub.tarifa_media
FROM (
  SELECT versao_id, AVG(NULLIF(tarifa_energia, 0)) AS tarifa_media
  FROM proposta_versao_ucs
  WHERE tarifa_energia IS NOT NULL
  GROUP BY versao_id
) sub
WHERE pv.id = sub.versao_id AND pv.tarifa_distribuidora IS NULL AND sub.tarifa_media > 0;

UPDATE proposta_versoes
SET sobredimensionamento = ROUND(((COALESCE(geracao_mensal,0) - consumo_mensal) / consumo_mensal) * 100, 2)
WHERE sobredimensionamento IS NULL AND consumo_mensal IS NOT NULL AND consumo_mensal > 0;

UPDATE proposta_versoes
SET economia_mensal_percent = ROUND((COALESCE(economia_mensal,0) / (consumo_mensal * tarifa_distribuidora)) * 100, 2)
WHERE economia_mensal_percent IS NULL AND consumo_mensal > 0 AND tarifa_distribuidora > 0;