DELETE FROM deal_custom_field_values
WHERE deal_id IN (
  SELECT d.id FROM deals d JOIN projetos p ON p.deal_id = d.id 
  WHERE p.external_source = 'solarmarket'
);

DELETE FROM proposta_versao_ucs WHERE versao_id IN (
  SELECT pv.id FROM proposta_versoes pv JOIN propostas_nativas pn ON pn.id = pv.proposta_id 
  WHERE pn.external_source = 'solarmarket'
);
DELETE FROM proposta_kit_itens WHERE kit_id IN (
  SELECT pk.id FROM proposta_kits pk
  JOIN proposta_versoes pv ON pv.id = pk.versao_id
  JOIN propostas_nativas pn ON pn.id = pv.proposta_id 
  WHERE pn.external_source = 'solarmarket'
);
DELETE FROM proposta_kits WHERE versao_id IN (
  SELECT pv.id FROM proposta_versoes pv JOIN propostas_nativas pn ON pn.id = pv.proposta_id 
  WHERE pn.external_source = 'solarmarket'
);
DELETE FROM proposta_versoes WHERE proposta_id IN (
  SELECT id FROM propostas_nativas WHERE external_source = 'solarmarket'
);
DELETE FROM propostas_nativas WHERE external_source = 'solarmarket';

DELETE FROM deal_kanban_projection WHERE deal_id IN (
  SELECT d.id FROM deals d JOIN projetos p ON p.deal_id = d.id 
  WHERE p.external_source = 'solarmarket'
);

CREATE TEMP TABLE _sm_deals AS
SELECT DISTINCT d.id FROM deals d JOIN projetos p ON p.deal_id = d.id 
WHERE p.external_source = 'solarmarket';

CREATE TEMP TABLE _sm_clientes AS
SELECT DISTINCT cliente_id FROM projetos WHERE external_source = 'solarmarket' AND cliente_id IS NOT NULL;

UPDATE projetos SET deal_id = NULL WHERE external_source = 'solarmarket';
DELETE FROM deals WHERE id IN (SELECT id FROM _sm_deals);
DELETE FROM projetos WHERE external_source = 'solarmarket';

DELETE FROM clientes WHERE external_source = 'solarmarket'
AND id IN (SELECT cliente_id FROM _sm_clientes)
AND id NOT IN (SELECT cliente_id FROM projetos WHERE cliente_id IS NOT NULL);

DELETE FROM external_entity_links WHERE source = 'solarmarket';

UPDATE solarmarket_promotion_jobs SET status = 'cancelled' 
WHERE status IN ('running', 'pending');