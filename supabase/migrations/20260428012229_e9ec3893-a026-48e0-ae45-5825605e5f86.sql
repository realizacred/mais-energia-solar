-- Correção cirúrgica dos funis/etapas de registros SolarMarket já migrados.
-- Não apaga dados e não altera registros manuais/nativos.

WITH sm_rows AS (
  SELECT
    p.tenant_id,
    p.id AS projeto_id,
    p.deal_id,
    d.pipeline_id AS primary_pipeline_id,
    pf.payload->>'name' AS sm_funil_name,
    pf.payload->'stage'->>'name' AS sm_etapa_name,
    m.pipeline_id AS mapped_pipeline_id,
    em.stage_id AS mapped_stage_id,
    row_number() OVER (
      PARTITION BY p.id, m.pipeline_id
      ORDER BY COALESCE(pf.payload->>'createdAt', '') DESC, pf.id DESC
    ) AS rn
  FROM public.projetos p
  JOIN public.deals d
    ON d.id = p.deal_id
   AND d.tenant_id = p.tenant_id
  JOIN public.sm_projeto_funis_raw pf
    ON pf.tenant_id = p.tenant_id
   AND pf.payload->'project'->>'id' = p.external_id
  JOIN public.sm_funil_pipeline_map m
    ON m.tenant_id = p.tenant_id
   AND m.sm_funil_name = pf.payload->>'name'
   AND m.role <> 'ignore'
   AND m.pipeline_id IS NOT NULL
  LEFT JOIN public.sm_etapa_stage_map em
    ON em.tenant_id = p.tenant_id
   AND em.sm_funil_name = pf.payload->>'name'
   AND lower(trim(em.sm_etapa_name)) = lower(trim(pf.payload->'stage'->>'name'))
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND p.external_source IN ('solarmarket', 'solar_market')
    AND p.deal_id IS NOT NULL
    AND COALESCE(pf.payload->>'name', '') <> 'Vendedores'
), primary_rows AS (
  SELECT *
  FROM sm_rows
  WHERE rn = 1
    AND mapped_pipeline_id = primary_pipeline_id
), project_targets AS (
  SELECT
    pr.projeto_id,
    pf_exec.id AS target_funil_id,
    pe_exec.id AS target_etapa_id
  FROM primary_rows pr
  JOIN public.pipelines pipe
    ON pipe.id = pr.mapped_pipeline_id
   AND pipe.tenant_id = pr.tenant_id
  JOIN public.projeto_funis pf_exec
    ON pf_exec.tenant_id = pr.tenant_id
   AND pf_exec.ativo = true
   AND lower(trim(pf_exec.nome)) = lower(trim(pipe.name))
  LEFT JOIN public.projeto_etapas pe_exec
    ON pe_exec.tenant_id = pr.tenant_id
   AND pe_exec.funil_id = pf_exec.id
   AND lower(trim(pe_exec.nome)) = lower(trim(pr.sm_etapa_name))
)
UPDATE public.projetos p
SET
  funil_id = pt.target_funil_id,
  etapa_id = COALESCE(pt.target_etapa_id, p.etapa_id),
  updated_at = now()
FROM project_targets pt
WHERE p.id = pt.projeto_id
  AND (
    p.funil_id IS DISTINCT FROM pt.target_funil_id
    OR (pt.target_etapa_id IS NOT NULL AND p.etapa_id IS DISTINCT FROM pt.target_etapa_id)
  );

WITH sm_rows AS (
  SELECT
    p.tenant_id,
    p.deal_id,
    d.pipeline_id AS primary_pipeline_id,
    m.pipeline_id AS mapped_pipeline_id,
    em.stage_id AS mapped_stage_id,
    row_number() OVER (
      PARTITION BY p.id, m.pipeline_id
      ORDER BY COALESCE(pf.payload->>'createdAt', '') DESC, pf.id DESC
    ) AS rn
  FROM public.projetos p
  JOIN public.deals d
    ON d.id = p.deal_id
   AND d.tenant_id = p.tenant_id
  JOIN public.sm_projeto_funis_raw pf
    ON pf.tenant_id = p.tenant_id
   AND pf.payload->'project'->>'id' = p.external_id
  JOIN public.sm_funil_pipeline_map m
    ON m.tenant_id = p.tenant_id
   AND m.sm_funil_name = pf.payload->>'name'
   AND m.role <> 'ignore'
   AND m.pipeline_id IS NOT NULL
  LEFT JOIN public.sm_etapa_stage_map em
    ON em.tenant_id = p.tenant_id
   AND em.sm_funil_name = pf.payload->>'name'
   AND lower(trim(em.sm_etapa_name)) = lower(trim(pf.payload->'stage'->>'name'))
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND p.external_source IN ('solarmarket', 'solar_market')
    AND p.deal_id IS NOT NULL
    AND COALESCE(pf.payload->>'name', '') <> 'Vendedores'
), primary_rows AS (
  SELECT *
  FROM sm_rows
  WHERE rn = 1
    AND mapped_pipeline_id = primary_pipeline_id
    AND mapped_stage_id IS NOT NULL
)
UPDATE public.deals d
SET
  stage_id = pr.mapped_stage_id,
  updated_at = now()
FROM primary_rows pr
WHERE d.id = pr.deal_id
  AND d.tenant_id = pr.tenant_id
  AND d.stage_id IS DISTINCT FROM pr.mapped_stage_id;

WITH sm_rows AS (
  SELECT
    p.tenant_id,
    p.deal_id,
    m.pipeline_id,
    em.stage_id,
    row_number() OVER (
      PARTITION BY p.id, m.pipeline_id
      ORDER BY COALESCE(pf.payload->>'createdAt', '') DESC, pf.id DESC
    ) AS rn
  FROM public.projetos p
  JOIN public.sm_projeto_funis_raw pf
    ON pf.tenant_id = p.tenant_id
   AND pf.payload->'project'->>'id' = p.external_id
  JOIN public.sm_funil_pipeline_map m
    ON m.tenant_id = p.tenant_id
   AND m.sm_funil_name = pf.payload->>'name'
   AND m.role <> 'ignore'
   AND m.pipeline_id IS NOT NULL
  JOIN public.sm_etapa_stage_map em
    ON em.tenant_id = p.tenant_id
   AND em.sm_funil_name = pf.payload->>'name'
   AND lower(trim(em.sm_etapa_name)) = lower(trim(pf.payload->'stage'->>'name'))
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND p.external_source IN ('solarmarket', 'solar_market')
    AND p.deal_id IS NOT NULL
    AND COALESCE(pf.payload->>'name', '') <> 'Vendedores'
)
INSERT INTO public.deal_pipeline_stages (tenant_id, deal_id, pipeline_id, stage_id)
SELECT tenant_id, deal_id, pipeline_id, stage_id
FROM sm_rows
WHERE rn = 1
ON CONFLICT (deal_id, pipeline_id)
DO UPDATE SET stage_id = EXCLUDED.stage_id;