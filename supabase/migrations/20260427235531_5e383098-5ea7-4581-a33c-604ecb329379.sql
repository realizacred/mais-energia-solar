
-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION: Reparos de mapeamento SolarMarket — FASE 1
-- Tenant: 17de8315-2e2f-4a79-8751-e5d507d69a41 (Mais Energia Solar)
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Renomear pipeline "LEAD" → "Comercial" e ajustar papel
UPDATE pipelines
SET name = 'Comercial', papel = 'comercial'
WHERE id = 'aded33c3-9b27-4ae9-86b0-1d2d5ad3c046'
  AND tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND name = 'LEAD';

-- 2) Renomear projeto_funis "LEAD" espelho → "Comercial" se existir
UPDATE projeto_funis
SET nome = 'Comercial'
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND lower(nome) = 'lead';

-- 3) Garantir mapeamento SM "LEAD" → pipeline Comercial (mesmo UUID)
UPDATE sm_funil_pipeline_map
SET role = 'pipeline'
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_funil_name = 'LEAD'
  AND pipeline_id = 'aded33c3-9b27-4ae9-86b0-1d2d5ad3c046';

-- 4) Garantir Pagamento permanece ignorado (defensivo)
UPDATE sm_funil_pipeline_map
SET role = 'ignore', pipeline_id = NULL
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_funil_name = 'Pagamento';

-- 5) Confirmar Vendedores como vendedor_source
UPDATE sm_funil_pipeline_map
SET role = 'vendedor_source', pipeline_id = NULL
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_funil_name = 'Vendedores';

-- 6) Função utilitária: validar prontidão de migração
CREATE OR REPLACE FUNCTION public.sm_validate_migration_readiness(p_tenant_id uuid)
RETURNS TABLE (
  check_name text,
  status text,
  details jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check 1: Funis SM mapeados
  RETURN QUERY
  WITH funis AS (
    SELECT DISTINCT payload->>'name' AS nome FROM sm_projeto_funis_raw
    WHERE tenant_id = p_tenant_id
  )
  SELECT
    'funis_sm_mapeados'::text,
    CASE WHEN COUNT(*) FILTER (WHERE m.sm_funil_name IS NULL) = 0 THEN 'ok' ELSE 'warning' END::text,
    jsonb_build_object(
      'total_funis', COUNT(*),
      'mapeados', COUNT(*) FILTER (WHERE m.sm_funil_name IS NOT NULL),
      'nao_mapeados', array_agg(f.nome) FILTER (WHERE m.sm_funil_name IS NULL)
    )
  FROM funis f
  LEFT JOIN sm_funil_pipeline_map m
    ON m.tenant_id = p_tenant_id AND m.sm_funil_name = f.nome;

  -- Check 2: Etapas SM mapeadas (excluindo Vendedores e Pagamento)
  RETURN QUERY
  WITH etapas AS (
    SELECT DISTINCT
      payload->>'name' AS funil_name,
      payload->'stage'->>'name' AS etapa_name
    FROM sm_projeto_funis_raw
    WHERE tenant_id = p_tenant_id
      AND payload->>'name' NOT IN ('Vendedores','Pagamento')
  )
  SELECT
    'etapas_sm_mapeadas'::text,
    CASE WHEN COUNT(*) FILTER (WHERE m.stage_id IS NULL) = 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object(
      'total_etapas', COUNT(*),
      'mapeadas', COUNT(*) FILTER (WHERE m.stage_id IS NOT NULL),
      'nao_mapeadas', array_agg(jsonb_build_object('funil', e.funil_name, 'etapa', e.etapa_name))
                       FILTER (WHERE m.stage_id IS NULL)
    )
  FROM etapas e
  LEFT JOIN sm_etapa_stage_map m
    ON m.tenant_id = p_tenant_id
    AND m.sm_funil_name = e.funil_name
    AND m.sm_etapa_name = e.etapa_name;

  -- Check 3: Pipelines existem para mapeamentos ativos
  RETURN QUERY
  SELECT
    'pipelines_validos'::text,
    CASE WHEN COUNT(*) FILTER (WHERE p.id IS NULL) = 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object(
      'mapeamentos_quebrados', COUNT(*) FILTER (WHERE p.id IS NULL),
      'detalhes', array_agg(m.sm_funil_name) FILTER (WHERE p.id IS NULL)
    )
  FROM sm_funil_pipeline_map m
  LEFT JOIN pipelines p ON p.id = m.pipeline_id AND p.is_active = true
  WHERE m.tenant_id = p_tenant_id
    AND m.role = 'pipeline';

  -- Check 4: Jobs órfãos
  RETURN QUERY
  SELECT
    'jobs_orfaos'::text,
    CASE WHEN COUNT(*) = 0 THEN 'ok' ELSE 'warning' END::text,
    jsonb_build_object(
      'jobs_orfaos', COUNT(*),
      'job_ids', array_agg(id)
    )
  FROM solarmarket_promotion_jobs
  WHERE tenant_id = p_tenant_id
    AND status = 'running'
    AND (last_step_at IS NULL OR last_step_at < now() - interval '5 min');

  -- Check 5: Staging populado
  RETURN QUERY
  SELECT
    'staging_populado'::text,
    CASE WHEN clientes > 0 AND projetos > 0 AND propostas > 0 THEN 'ok' ELSE 'error' END::text,
    jsonb_build_object('clientes', clientes, 'projetos', projetos, 'propostas', propostas, 'funis', funis, 'projeto_funis', proj_funis)
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
