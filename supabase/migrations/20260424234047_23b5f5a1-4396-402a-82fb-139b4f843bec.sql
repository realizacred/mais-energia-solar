-- Migration one-shot para tenant 17de8315-2e2f-4a79-8751-e5d507d69a41 (Mais Energia Solar)
-- Popula sm_etapa_stage_map para o funil LEAD (6 etapas → 6 stages do pipeline Comercial)
-- Idempotente via ON CONFLICT (tenant_id, sm_funil_name, sm_etapa_name)

DO $$
DECLARE
  v_tenant_id uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_pipeline_id uuid;
  v_missing text;
BEGIN
  -- Asserção 1: pipeline 'Comercial' deve existir para o tenant
  SELECT id INTO v_pipeline_id
  FROM public.pipelines
  WHERE tenant_id = v_tenant_id AND name = 'Comercial'
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'Pipeline "Comercial" não existe para tenant %. Rode sm-criar-pipeline-auto antes.', v_tenant_id;
  END IF;

  -- Asserção 2: cada uma das 6 stages destino deve existir no pipeline
  SELECT string_agg(needed.name, ', ') INTO v_missing
  FROM (VALUES
    ('Recebido'),
    ('Enviar Proposta'),
    ('Proposta enviada'),
    ('Qualificado'),
    ('Negociação'),
    ('Proposta Aprovada')
  ) AS needed(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pipeline_stages ps
    WHERE ps.pipeline_id = v_pipeline_id AND ps.name = needed.name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Stages faltando no pipeline Comercial (%): %', v_pipeline_id, v_missing;
  END IF;

  -- INSERT idempotente das 6 linhas
  INSERT INTO public.sm_etapa_stage_map (tenant_id, sm_funil_name, sm_etapa_name, stage_id)
  VALUES
    -- Recebido (SM) → Recebido (CRM)
    (v_tenant_id, 'LEAD', 'Recebido',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Recebido')),
    -- Enviar Proposta (SM) → Enviar Proposta (CRM)
    (v_tenant_id, 'LEAD', 'Enviar Proposta',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Enviar Proposta')),
    -- Proposta enviada (SM) → Proposta enviada (CRM)
    (v_tenant_id, 'LEAD', 'Proposta enviada',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Proposta enviada')),
    -- Qualificado (SM) → Qualificado (CRM)
    (v_tenant_id, 'LEAD', 'Qualificado',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Qualificado')),
    -- Negociação (SM) → Negociação (CRM)
    (v_tenant_id, 'LEAD', 'Negociação',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Negociação')),
    -- Fechado (SM) → Proposta Aprovada (CRM) — decisão de negócio confirmada pelo usuário
    (v_tenant_id, 'LEAD', 'Fechado',
      (SELECT id FROM public.pipeline_stages WHERE pipeline_id = v_pipeline_id AND name = 'Proposta Aprovada'))
  ON CONFLICT (tenant_id, sm_funil_name, sm_etapa_name)
  DO UPDATE SET stage_id = EXCLUDED.stage_id;
END $$;