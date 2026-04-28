DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid;
BEGIN
  DELETE FROM public.projeto_etapas pe
  USING public.projeto_funis pf
  WHERE pe.funil_id = pf.id
    AND pf.tenant_id = v_tenant
    AND pe.tenant_id = v_tenant
    AND lower(trim(pf.nome)) IN ('lead', 'pagamento')
    AND NOT EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.tenant_id = v_tenant
        AND p.etapa_id = pe.id
    );

  DELETE FROM public.projeto_funis pf
  WHERE pf.tenant_id = v_tenant
    AND lower(trim(pf.nome)) IN ('lead', 'pagamento')
    AND NOT EXISTS (
      SELECT 1
      FROM public.projetos p
      WHERE p.tenant_id = v_tenant
        AND p.funil_id = pf.id
    );
END $$;