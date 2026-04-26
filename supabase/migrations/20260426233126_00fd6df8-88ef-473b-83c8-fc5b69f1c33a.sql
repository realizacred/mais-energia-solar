DO $$
DECLARE
  _tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
BEGIN
  -- 0) Cancela jobs ativos
  UPDATE public.solarmarket_promotion_jobs
     SET status = 'cancelled', finished_at = now(), updated_at = now(),
         error_summary = COALESCE(error_summary,'') || ' | reset_total'
   WHERE tenant_id = _tenant AND status IN ('pending','running');

  UPDATE public.solarmarket_import_jobs
     SET status = 'cancelled', finished_at = now(), updated_at = now()
   WHERE tenant_id = _tenant AND status IN ('pending','running');

  -- 1a) Versões/kits/UCs SM
  DELETE FROM public.proposta_versao_ucs puv
   USING public.proposta_versoes pv, public.propostas_nativas pn
   WHERE puv.versao_id = pv.id AND pv.proposta_id = pn.id
     AND pn.tenant_id = _tenant
     AND pn.external_source IN ('solar_market','solarmarket');

  DELETE FROM public.proposta_kits pk
   USING public.proposta_versoes pv, public.propostas_nativas pn
   WHERE pk.versao_id = pv.id AND pv.proposta_id = pn.id
     AND pn.tenant_id = _tenant
     AND pn.external_source IN ('solar_market','solarmarket');

  DELETE FROM public.proposta_versoes pv
   USING public.propostas_nativas pn
   WHERE pv.proposta_id = pn.id
     AND pn.tenant_id = _tenant
     AND pn.external_source IN ('solar_market','solarmarket');

  -- 1b) Recebimentos vinculados a projetos SM
  DELETE FROM public.recebimentos r
   USING public.projetos p
   WHERE r.projeto_id = p.id
     AND p.tenant_id = _tenant
     AND p.external_source IN ('solar_market','solarmarket');

  -- 1c) Custom field values e projeções dos deals SM (por origem ou via projeto SM)
  DELETE FROM public.deal_custom_field_values dcfv
   USING public.deals d
   WHERE dcfv.deal_id = d.id
     AND d.tenant_id = _tenant
     AND (
       d.origem IN ('solar_market','solarmarket')
       OR EXISTS (
         SELECT 1 FROM public.projetos p
          WHERE p.id = d.projeto_id
            AND p.external_source IN ('solar_market','solarmarket')
       )
     );

  DELETE FROM public.deal_kanban_projection dkp
   USING public.deals d
   WHERE dkp.deal_id = d.id
     AND d.tenant_id = _tenant
     AND (
       d.origem IN ('solar_market','solarmarket')
       OR EXISTS (
         SELECT 1 FROM public.projetos p
          WHERE p.id = d.projeto_id
            AND p.external_source IN ('solar_market','solarmarket')
       )
     );

  -- 2) Propostas nativas SM
  DELETE FROM public.propostas_nativas
   WHERE tenant_id = _tenant
     AND external_source IN ('solar_market','solarmarket');

  -- 3) Deals SM (por origem OU por projeto SM)
  DELETE FROM public.deals d
   WHERE d.tenant_id = _tenant
     AND (
       d.origem IN ('solar_market','solarmarket')
       OR EXISTS (
         SELECT 1 FROM public.projetos p
          WHERE p.id = d.projeto_id
            AND p.external_source IN ('solar_market','solarmarket')
       )
     );

  -- 4) Projetos SM
  DELETE FROM public.projetos
   WHERE tenant_id = _tenant
     AND external_source IN ('solar_market','solarmarket');

  -- 5) Clientes SM
  DELETE FROM public.clientes
   WHERE tenant_id = _tenant
     AND external_source IN ('solar_market','solarmarket');

  -- 6) Vínculos / mapeamentos
  DELETE FROM public.external_entity_links
   WHERE tenant_id = _tenant
     AND source IN ('solar_market','solarmarket');

  DELETE FROM public.sm_consultor_mapping WHERE tenant_id = _tenant;

  -- 7) Staging SM
  DELETE FROM public.sm_propostas_raw       WHERE tenant_id = _tenant;
  DELETE FROM public.sm_projeto_funis_raw   WHERE tenant_id = _tenant;
  DELETE FROM public.sm_projetos_raw        WHERE tenant_id = _tenant;
  DELETE FROM public.sm_clientes_raw        WHERE tenant_id = _tenant;
  DELETE FROM public.sm_funis_raw           WHERE tenant_id = _tenant;
  DELETE FROM public.sm_custom_fields_raw   WHERE tenant_id = _tenant;

  -- 8) Histórico jobs/logs SM
  DELETE FROM public.solarmarket_promotion_logs WHERE tenant_id = _tenant;
  DELETE FROM public.solarmarket_promotion_jobs WHERE tenant_id = _tenant;
  DELETE FROM public.solarmarket_import_logs    WHERE tenant_id = _tenant;
  DELETE FROM public.solarmarket_import_jobs    WHERE tenant_id = _tenant;

  RAISE NOTICE 'Reset total SM concluído';
END;
$$;