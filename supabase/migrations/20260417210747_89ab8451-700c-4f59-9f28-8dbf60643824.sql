CREATE OR REPLACE FUNCTION public.validate_sm_migration_integrity(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int := 0;
  v_sem_cliente int := 0;
  v_sem_funil int := 0;
  v_sem_etapa int := 0;
  v_funil_invalido int := 0;
  v_etapa_invalida int := 0;
BEGIN
  SELECT count(*) INTO v_total
  FROM public.projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market';

  SELECT count(*) INTO v_sem_cliente
  FROM public.projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
    AND cliente_id IS NULL;

  SELECT count(*) INTO v_sem_funil
  FROM public.projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
    AND funil_id IS NULL;

  SELECT count(*) INTO v_sem_etapa
  FROM public.projetos
  WHERE tenant_id = p_tenant_id AND import_source = 'solar_market'
    AND etapa_id IS NULL;

  SELECT count(*) INTO v_funil_invalido
  FROM public.projetos p
  WHERE p.tenant_id = p_tenant_id AND p.import_source = 'solar_market'
    AND p.funil_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.projeto_funis f
      WHERE f.id = p.funil_id AND f.tenant_id = p_tenant_id
    );

  SELECT count(*) INTO v_etapa_invalida
  FROM public.projetos p
  WHERE p.tenant_id = p_tenant_id AND p.import_source = 'solar_market'
    AND p.etapa_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.projeto_etapas e
      WHERE e.id = p.etapa_id
        AND (p.funil_id IS NULL OR e.funil_id = p.funil_id)
    );

  RETURN jsonb_build_object(
    'total_validados', v_total,
    'projetos_sem_cliente', v_sem_cliente,
    'projetos_sem_funil', v_sem_funil,
    'projetos_sem_etapa', v_sem_etapa,
    'projetos_funil_invalido', v_funil_invalido,
    'projetos_etapa_invalida', v_etapa_invalida,
    'ok', (v_sem_cliente + v_sem_funil + v_sem_etapa + v_funil_invalido + v_etapa_invalida) = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_sm_migration_integrity(uuid) TO authenticated;