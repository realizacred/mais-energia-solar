DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
BEGIN
  UPDATE solarmarket_promotion_jobs
  SET status='cancelled', finished_at=now()
  WHERE tenant_id=v_tenant AND status IN ('running','pending');

  -- Apaga filhos das propostas SM
  DELETE FROM deal_custom_field_values dcfv
  USING deals d, projetos p
  WHERE dcfv.deal_id = d.id AND d.id = p.deal_id
    AND p.tenant_id = v_tenant AND p.external_source IN ('solarmarket','solar_market');

  DELETE FROM proposta_versao_ucs puv
  USING proposta_versoes pv, propostas_nativas pn
  WHERE puv.versao_id = pv.id AND pv.proposta_id = pn.id
    AND pn.tenant_id = v_tenant AND pn.external_source IN ('solarmarket','solar_market');

  DELETE FROM proposta_kit_itens pki
  USING proposta_kits pk, proposta_versoes pv, propostas_nativas pn
  WHERE pki.kit_id = pk.id AND pk.versao_id = pv.id AND pv.proposta_id = pn.id
    AND pn.tenant_id = v_tenant AND pn.external_source IN ('solarmarket','solar_market');

  DELETE FROM proposta_kits pk
  USING proposta_versoes pv, propostas_nativas pn
  WHERE pk.versao_id = pv.id AND pv.proposta_id = pn.id
    AND pn.tenant_id = v_tenant AND pn.external_source IN ('solarmarket','solar_market');

  DELETE FROM proposta_versoes pv
  USING propostas_nativas pn
  WHERE pv.proposta_id = pn.id
    AND pn.tenant_id = v_tenant AND pn.external_source IN ('solarmarket','solar_market');

  DELETE FROM recebimentos r
  USING projetos p
  WHERE r.projeto_id = p.id
    AND p.tenant_id = v_tenant AND p.external_source IN ('solarmarket','solar_market');

  DELETE FROM propostas_nativas
  WHERE tenant_id = v_tenant AND external_source IN ('solarmarket','solar_market');

  -- Projeções e deals (ANTES de projetos por FK NOT NULL deals.projeto_id)
  DELETE FROM deal_kanban_projection dkp
  USING deals d, projetos p
  WHERE dkp.deal_id = d.id
    AND (d.id = p.deal_id OR d.projeto_id = p.id)
    AND p.tenant_id = v_tenant AND p.external_source IN ('solarmarket','solar_market');

  DELETE FROM deals d
  USING projetos p
  WHERE (d.id = p.deal_id OR d.projeto_id = p.id)
    AND p.tenant_id = v_tenant AND p.external_source IN ('solarmarket','solar_market');

  -- Agora projetos podem cair
  DELETE FROM projetos
  WHERE tenant_id = v_tenant AND external_source IN ('solarmarket','solar_market');

  DELETE FROM clientes
  WHERE tenant_id = v_tenant AND external_source IN ('solarmarket','solar_market');

  DELETE FROM external_entity_links
  WHERE tenant_id = v_tenant AND source IN ('solarmarket','solar_market');
END $$;