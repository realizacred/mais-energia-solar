DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid;
BEGIN
  DELETE FROM public.projeto_etapas pe
  USING public.projeto_funis pf
  JOIN public.sm_funil_pipeline_map m
    ON m.tenant_id = pf.tenant_id
   AND lower(trim(m.sm_funil_name)) = lower(trim(pf.nome))
  WHERE pe.funil_id = pf.id
    AND pe.tenant_id = v_tenant
    AND pf.tenant_id = v_tenant
    AND m.role IN ('ignore', 'vendedor_source')
    AND NOT EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.tenant_id = v_tenant
        AND p.etapa_id = pe.id
    );

  DELETE FROM public.projeto_funis pf
  USING public.sm_funil_pipeline_map m
  WHERE pf.tenant_id = v_tenant
    AND m.tenant_id = v_tenant
    AND lower(trim(m.sm_funil_name)) = lower(trim(pf.nome))
    AND m.role IN ('ignore', 'vendedor_source')
    AND NOT EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.tenant_id = v_tenant
        AND p.funil_id = pf.id
    );
END $$;