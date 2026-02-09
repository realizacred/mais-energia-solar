UPDATE leads l
SET cidade = o.cidade, estado = o.estado
FROM orcamentos o
WHERE o.lead_id = l.id
AND (l.cidade = 'N/A' OR l.estado = 'N/A')
AND o.cidade IS NOT NULL AND o.cidade != 'N/A';