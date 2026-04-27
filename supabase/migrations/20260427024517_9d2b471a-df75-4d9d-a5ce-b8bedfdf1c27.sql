-- Limpa pipelines extras do tenant solicitado, mantendo apenas "Comercial".
-- Também remove projeto_funis espelho equivalentes (mantendo "Comercial").
-- Tenant: 17de8315-2e2f-4a79-8751-e5d507d69a41

DO $$
DECLARE
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
BEGIN
  -- 1) Apagar stages dos pipelines não-comerciais
  DELETE FROM public.pipeline_stages
  WHERE pipeline_id IN (
    SELECT id FROM public.pipelines
    WHERE tenant_id = v_tenant
      AND lower(name) <> 'comercial'
  );

  -- 2) Apagar pipelines não-comerciais (sem deals vinculados)
  DELETE FROM public.pipelines
  WHERE tenant_id = v_tenant
    AND lower(name) <> 'comercial'
    AND NOT EXISTS (
      SELECT 1 FROM public.deals d WHERE d.pipeline_id = public.pipelines.id
    );

  -- 3) Espelho de execução: remover projeto_etapas + projeto_funis não-comerciais
  DELETE FROM public.projeto_etapas
  WHERE funil_id IN (
    SELECT id FROM public.projeto_funis
    WHERE tenant_id = v_tenant
      AND lower(nome) <> 'comercial'
  );

  DELETE FROM public.projeto_funis
  WHERE tenant_id = v_tenant
    AND lower(nome) <> 'comercial'
    AND NOT EXISTS (
      SELECT 1 FROM public.projetos p WHERE p.funil_id = public.projeto_funis.id
    );
END $$;