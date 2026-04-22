-- Limpa links órfãos do SolarMarket (apontando para entidades CRM já deletadas)
-- e força a re-promoção criar novos registros do zero.
DELETE FROM public.external_entity_links l
WHERE l.source = 'solar_market'
  AND (
    (l.entity_type = 'cliente' AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = l.entity_id))
    OR (l.entity_type = 'projeto' AND NOT EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = l.entity_id))
    OR (l.entity_type = 'proposta' AND NOT EXISTS (SELECT 1 FROM public.propostas_nativas pn WHERE pn.id = l.entity_id))
  );