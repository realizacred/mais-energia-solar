-- Backfill: copiar estado/cidade/area dos orcamentos para leads com "N/A"
UPDATE leads l
SET
  estado = o.estado,
  cidade = o.cidade,
  area = o.area,
  tipo_telhado = o.tipo_telhado,
  rede_atendimento = o.rede_atendimento,
  media_consumo = COALESCE(o.media_consumo, 0),
  consumo_previsto = COALESCE(o.consumo_previsto, 0),
  cep = COALESCE(o.cep, l.cep),
  bairro = COALESCE(o.bairro, l.bairro)
FROM (
  SELECT DISTINCT ON (lead_id)
    lead_id, estado, cidade, area, tipo_telhado, rede_atendimento,
    media_consumo, consumo_previsto, cep, bairro
  FROM orcamentos
  ORDER BY lead_id, created_at DESC
) o
WHERE o.lead_id = l.id
  AND l.estado = 'N/A'
  AND l.deleted_at IS NULL;