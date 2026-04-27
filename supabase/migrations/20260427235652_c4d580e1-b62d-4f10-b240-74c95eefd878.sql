
DROP FUNCTION IF EXISTS public.sm_validate_migration_readiness(uuid);

CREATE FUNCTION public.sm_validate_migration_readiness(p_tenant_id uuid)
RETURNS TABLE (
  check_name text,
  check_status text,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH funis AS (
    SELECT DISTINCT payload->>'name' AS nome FROM sm_projeto_funis_raw WHERE tenant_id = p_tenant_id
  )
  SELECT
    'funis_sm_mapeados'::text,
    CASE WHEN COUNT(*) FILTER (WHERE m.sm_funil_name IS NULL) = 0 THEN 'ok' ELSE 'warning' END::text,
    jsonb_build_object(
      'total_funis', COUNT(*),
      'mapeados', COUNT(*) FILTER (WHERE m.sm_funil_name IS NOT NULL),
      'nao_mapeados', COALESCE(array_agg(f.nome) FILTER (WHERE m.sm_funil_name IS NULL), ARRAY[]::text[])
    )
  FROM funis f
  LEFT JOIN sm_funil_pipeline_map m ON m.tenant_id = p_tenant_id AND m.sm_funil_name = f.nome;

  RETURN QUERY
  WITH etapas AS (
    SELECT DISTINCT payload->>'name' AS funil_name, payload->'stage'->>'name' AS etapa_name
    FROM sm_projeto_funis_raw
    WHERE tenant_id = p_tenant_id AND payload->>'name' NOT IN ('Vendedores','Pagamento')
  )
  SELECT
    'etapas_sm_mapeadas'::text,
    CASE WHEN COUNT(*) FILTER (WHERE m.stage_id IS NULL) = 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object(
      'total_etapas', COUNT(*),
      'mapeadas', COUNT(*) FILTER (WHERE m.stage_id IS NOT NULL),
      'nao_mapeadas', COALESCE(array_agg(jsonb_build_object('funil', e.funil_name, 'etapa', e.etapa_name)) FILTER (WHERE m.stage_id IS NULL), ARRAY[]::jsonb[])
    )
  FROM etapas e
  LEFT JOIN sm_etapa_stage_map m ON m.tenant_id = p_tenant_id AND m.sm_funil_name = e.funil_name AND m.sm_etapa_name = e.etapa_name;

  RETURN QUERY
  SELECT
    'pipelines_validos'::text,
    CASE WHEN COUNT(*) FILTER (WHERE p.id IS NULL) = 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object(
      'mapeamentos_quebrados', COUNT(*) FILTER (WHERE p.id IS NULL),
      'detalhes', COALESCE(array_agg(m.sm_funil_name) FILTER (WHERE p.id IS NULL), ARRAY[]::text[])
    )
  FROM sm_funil_pipeline_map m
  LEFT JOIN pipelines p ON p.id = m.pipeline_id AND p.is_active = true
  WHERE m.tenant_id = p_tenant_id AND m.role = 'pipeline';

  RETURN QUERY
  SELECT
    'jobs_orfaos'::text,
    CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'warning' END::text,
    jsonb_build_object('jobs_orfaos', COUNT(*), 'job_ids', COALESCE(array_agg(j.id), ARRAY[]::uuid[]))
  FROM solarmarket_promotion_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.status = 'running'
    AND (j.last_step_at IS NULL OR j.last_step_at < now() - interval '5 min');

  RETURN QUERY
  SELECT
    'staging_populado'::text,
    CASE WHEN x.clientes > 0 AND x.projetos > 0 AND x.propostas > 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object('clientes', x.clientes, 'projetos', x.projetos, 'propostas', x.propostas, 'funis', x.funis, 'projeto_funis', x.proj_funis)
  FROM (
    SELECT
      (SELECT COUNT(*) FROM sm_clientes_raw WHERE tenant_id = p_tenant_id) AS clientes,
      (SELECT COUNT(*) FROM sm_projetos_raw WHERE tenant_id = p_tenant_id) AS projetos,
      (SELECT COUNT(*) FROM sm_propostas_raw WHERE tenant_id = p_tenant_id) AS propostas,
      (SELECT COUNT(*) FROM sm_funis_raw WHERE tenant_id = p_tenant_id) AS funis,
      (SELECT COUNT(*) FROM sm_projeto_funis_raw WHERE tenant_id = p_tenant_id) AS proj_funis
  ) x;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sm_validate_migration_readiness(uuid) TO authenticated;
