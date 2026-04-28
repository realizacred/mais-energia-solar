-- Correção cirúrgica das etapas do pipeline Comercial para registros SolarMarket já migrados.
-- Cobre casos sem linha explícita em sm_etapa_stage_map, como LEAD/Proposta enviada e LEAD/Fechado.

WITH lead_rows AS (
  SELECT
    p.tenant_id,
    p.deal_id,
    d.pipeline_id,
    pf.payload->'stage'->>'name' AS sm_etapa_name,
    COALESCE(
      em.stage_id,
      exact_stage.id,
      CASE
        WHEN lower(trim(pf.payload->'stage'->>'name')) IN ('fechado', 'ganho', 'ganha', 'venda fechada') THEN won_stage.id
        ELSE NULL
      END
    ) AS target_stage_id,
    row_number() OVER (
      PARTITION BY p.id, d.pipeline_id
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
   AND m.pipeline_id = d.pipeline_id
   AND m.role <> 'ignore'
  LEFT JOIN public.sm_etapa_stage_map em
    ON em.tenant_id = p.tenant_id
   AND em.sm_funil_name = pf.payload->>'name'
   AND lower(trim(em.sm_etapa_name)) = lower(trim(pf.payload->'stage'->>'name'))
  LEFT JOIN public.pipeline_stages exact_stage
    ON exact_stage.tenant_id = p.tenant_id
   AND exact_stage.pipeline_id = d.pipeline_id
   AND lower(trim(exact_stage.name)) = lower(trim(pf.payload->'stage'->>'name'))
  LEFT JOIN public.pipeline_stages won_stage
    ON won_stage.tenant_id = p.tenant_id
   AND won_stage.pipeline_id = d.pipeline_id
   AND won_stage.is_won = true
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND p.external_source IN ('solarmarket', 'solar_market')
    AND p.deal_id IS NOT NULL
    AND pf.payload->>'name' = 'LEAD'
)
UPDATE public.deals d
SET
  stage_id = lr.target_stage_id,
  updated_at = now()
FROM lead_rows lr
WHERE lr.rn = 1
  AND lr.target_stage_id IS NOT NULL
  AND d.id = lr.deal_id
  AND d.tenant_id = lr.tenant_id
  AND d.stage_id IS DISTINCT FROM lr.target_stage_id;

WITH lead_rows AS (
  SELECT
    p.tenant_id,
    p.deal_id,
    d.pipeline_id,
    COALESCE(
      em.stage_id,
      exact_stage.id,
      CASE
        WHEN lower(trim(pf.payload->'stage'->>'name')) IN ('fechado', 'ganho', 'ganha', 'venda fechada') THEN won_stage.id
        ELSE NULL
      END
    ) AS target_stage_id,
    row_number() OVER (
      PARTITION BY p.id, d.pipeline_id
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
   AND m.pipeline_id = d.pipeline_id
   AND m.role <> 'ignore'
  LEFT JOIN public.sm_etapa_stage_map em
    ON em.tenant_id = p.tenant_id
   AND em.sm_funil_name = pf.payload->>'name'
   AND lower(trim(em.sm_etapa_name)) = lower(trim(pf.payload->'stage'->>'name'))
  LEFT JOIN public.pipeline_stages exact_stage
    ON exact_stage.tenant_id = p.tenant_id
   AND exact_stage.pipeline_id = d.pipeline_id
   AND lower(trim(exact_stage.name)) = lower(trim(pf.payload->'stage'->>'name'))
  LEFT JOIN public.pipeline_stages won_stage
    ON won_stage.tenant_id = p.tenant_id
   AND won_stage.pipeline_id = d.pipeline_id
   AND won_stage.is_won = true
  WHERE p.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND p.external_source IN ('solarmarket', 'solar_market')
    AND p.deal_id IS NOT NULL
    AND pf.payload->>'name' = 'LEAD'
)
INSERT INTO public.deal_pipeline_stages (tenant_id, deal_id, pipeline_id, stage_id)
SELECT tenant_id, deal_id, pipeline_id, target_stage_id
FROM lead_rows
WHERE rn = 1
  AND target_stage_id IS NOT NULL
ON CONFLICT (deal_id, pipeline_id)
DO UPDATE SET stage_id = EXCLUDED.stage_id;