CREATE OR REPLACE FUNCTION public.backfill_projetos_funil_etapa(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sm_matched int := 0;
  v_sm_default int := 0;
  v_native_default int := 0;
  v_engenharia_funil uuid;
  v_engenharia_etapa1 uuid;
BEGIN
  SELECT id INTO v_engenharia_funil
  FROM projeto_funis
  WHERE tenant_id = p_tenant_id AND nome = 'Engenharia'
  LIMIT 1;

  IF v_engenharia_funil IS NULL THEN
    RETURN jsonb_build_object('error', 'Funil "Engenharia" não encontrado para o tenant');
  END IF;

  SELECT id INTO v_engenharia_etapa1
  FROM projeto_etapas
  WHERE funil_id = v_engenharia_funil AND ordem = 1
  LIMIT 1;

  -- 1. Projetos SM com correspondência exata por nome de funil/etapa
  WITH matched AS (
    UPDATE projetos p
    SET funil_id = pe.funil_id, etapa_id = pe.id
    FROM solar_market_projects smp
    JOIN projeto_funis pf
      ON pf.tenant_id = p.tenant_id AND pf.nome ILIKE smp.sm_funnel_name
    JOIN projeto_etapas pe
      ON pe.funil_id = pf.id AND pe.nome ILIKE smp.sm_stage_name
    WHERE p.tenant_id = p_tenant_id
      AND p.import_source = 'solar_market'
      AND (p.funil_id IS NULL OR p.etapa_id IS NULL)
      AND smp.sm_funnel_name IS NOT NULL
      AND smp.sm_stage_name IS NOT NULL
      AND (
        (smp.lead_id IS NOT NULL AND smp.lead_id = p.lead_id)
        OR (p.snapshot->>'sm_project_id' = smp.sm_project_id::text)
      )
    RETURNING p.id
  )
  SELECT count(*) INTO v_sm_matched FROM matched;

  -- 2. Projetos SM sem match → primeira etapa de Engenharia
  WITH defaulted AS (
    UPDATE projetos p
    SET funil_id = v_engenharia_funil, etapa_id = v_engenharia_etapa1
    WHERE p.tenant_id = p_tenant_id
      AND p.import_source = 'solar_market'
      AND (p.funil_id IS NULL OR p.etapa_id IS NULL)
    RETURNING p.id
  )
  SELECT count(*) INTO v_sm_default FROM defaulted;

  -- 3. Projetos nativos sem funil → primeira etapa de Engenharia
  WITH defaulted AS (
    UPDATE projetos p
    SET funil_id = v_engenharia_funil, etapa_id = v_engenharia_etapa1
    WHERE p.tenant_id = p_tenant_id
      AND (p.funil_id IS NULL OR p.etapa_id IS NULL)
    RETURNING p.id
  )
  SELECT count(*) INTO v_native_default FROM defaulted;

  RETURN jsonb_build_object(
    'sm_matched', v_sm_matched,
    'sm_default', v_sm_default,
    'native_default', v_native_default,
    'total', v_sm_matched + v_sm_default + v_native_default
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_projetos_funil_etapa(uuid) TO authenticated;