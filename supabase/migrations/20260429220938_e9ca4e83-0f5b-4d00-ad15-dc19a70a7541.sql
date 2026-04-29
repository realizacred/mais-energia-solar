-- Backfill: vincula cliente.lead_id em clientes migrados do SolarMarket
-- quando existe lead com o mesmo telefone_normalized no tenant.
-- RB-59 (paridade funcional): clientes migrados devem se comportar como nativos.
WITH matches AS (
  SELECT DISTINCT ON (c.id)
    c.id AS cliente_id,
    l.id AS lead_id
  FROM clientes c
  JOIN leads l
    ON l.tenant_id = c.tenant_id
   AND l.telefone_normalized = c.telefone_normalized
   AND l.telefone_normalized IS NOT NULL
   AND length(l.telefone_normalized) BETWEEN 10 AND 11
   AND l.deleted_at IS NULL
  WHERE c.external_source IN ('solarmarket','solar_market')
    AND c.lead_id IS NULL
  ORDER BY c.id, l.created_at ASC
)
UPDATE clientes c
SET lead_id = m.lead_id,
    updated_at = now()
FROM matches m
WHERE c.id = m.cliente_id;