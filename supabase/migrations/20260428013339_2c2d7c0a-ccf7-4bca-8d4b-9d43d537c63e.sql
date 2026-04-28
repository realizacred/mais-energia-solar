-- Corrigir ordem das etapas migradas do SolarMarket conforme o campo original payload.stages[].order
-- Escopo cirúrgico: tenant principal e apenas etapas com correspondência exata por nome de funil/pipeline + nome de etapa.

WITH sm_stages AS (
  SELECT
    r.tenant_id,
    lower(trim(r.payload->>'name')) AS funil_key,
    lower(trim(stage.value->>'name')) AS etapa_key,
    (stage.value->>'order')::integer AS sm_order
  FROM public.sm_funis_raw r
  CROSS JOIN LATERAL jsonb_array_elements(r.payload->'stages') AS stage(value)
  WHERE r.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND jsonb_typeof(r.payload->'stages') = 'array'
    AND stage.value ? 'name'
    AND stage.value ? 'order'
), updated_project_stages AS (
  UPDATE public.projeto_etapas pe
  SET ordem = ss.sm_order
  FROM public.projeto_funis pf
  JOIN sm_stages ss
    ON ss.tenant_id = pf.tenant_id
   AND ss.funil_key = lower(trim(pf.nome))
  WHERE pe.funil_id = pf.id
    AND pe.tenant_id = pf.tenant_id
    AND pe.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND lower(trim(pe.nome)) = ss.etapa_key
    AND pe.ordem IS DISTINCT FROM ss.sm_order
  RETURNING pe.id
)
SELECT count(*) AS projeto_etapas_reordenadas FROM updated_project_stages;

WITH sm_stages AS (
  SELECT
    r.tenant_id,
    lower(trim(r.payload->>'name')) AS funil_key,
    lower(trim(stage.value->>'name')) AS etapa_key,
    (stage.value->>'order')::integer AS sm_order
  FROM public.sm_funis_raw r
  CROSS JOIN LATERAL jsonb_array_elements(r.payload->'stages') AS stage(value)
  WHERE r.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND jsonb_typeof(r.payload->'stages') = 'array'
    AND stage.value ? 'name'
    AND stage.value ? 'order'
), updated_pipeline_stages AS (
  UPDATE public.pipeline_stages ps
  SET position = ss.sm_order
  FROM public.pipelines p
  JOIN sm_stages ss
    ON ss.tenant_id = p.tenant_id
   AND ss.funil_key = lower(trim(p.name))
  WHERE ps.pipeline_id = p.id
    AND ps.tenant_id = p.tenant_id
    AND ps.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND lower(trim(ps.name)) = ss.etapa_key
    AND ps.position IS DISTINCT FROM ss.sm_order
  RETURNING ps.id
)
SELECT count(*) AS pipeline_stages_reordenadas FROM updated_pipeline_stages;

WITH sm_funis AS (
  SELECT
    tenant_id,
    lower(trim(payload->>'name')) AS funil_key,
    (payload->>'order')::integer AS sm_order
  FROM public.sm_funis_raw
  WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND payload ? 'name'
    AND payload ? 'order'
), updated_project_funnels AS (
  UPDATE public.projeto_funis pf
  SET ordem = sf.sm_order
  FROM sm_funis sf
  WHERE pf.tenant_id = sf.tenant_id
    AND pf.tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'::uuid
    AND lower(trim(pf.nome)) = sf.funil_key
    AND pf.ordem IS DISTINCT FROM sf.sm_order
  RETURNING pf.id
)
SELECT count(*) AS projeto_funis_reordenados FROM updated_project_funnels;