DO $$
DECLARE
  v_pipelines_sm uuid[];
BEGIN
  -- Pipelines criados pela migração SM (vinculados em sm_funil_pipeline_map com role='pipeline')
  -- EXCLUI o Comercial (padrão do sistema), mesmo que esteja mapeado ao funil LEAD
  SELECT array_agg(DISTINCT m.pipeline_id) INTO v_pipelines_sm
  FROM sm_funil_pipeline_map m
  JOIN pipelines p ON p.id = m.pipeline_id
  WHERE m.role = 'pipeline'
    AND m.pipeline_id IS NOT NULL
    AND lower(p.name) <> 'comercial';

  RAISE NOTICE 'Pipelines SM a apagar: %', COALESCE(array_length(v_pipelines_sm,1),0);

  -- Apagar mapeamentos de etapas vinculados a stages desses pipelines
  DELETE FROM sm_etapa_stage_map
  WHERE stage_id IN (
    SELECT id FROM pipeline_stages
    WHERE pipeline_id = ANY(COALESCE(v_pipelines_sm, ARRAY[]::uuid[]))
  );

  -- Apagar stages e pipelines
  DELETE FROM pipeline_stages
  WHERE pipeline_id = ANY(COALESCE(v_pipelines_sm, ARRAY[]::uuid[]));

  DELETE FROM pipelines
  WHERE id = ANY(COALESCE(v_pipelines_sm, ARRAY[]::uuid[]));

  -- Limpar TODOS os mapeamentos sm_funil_pipeline_map e sm_etapa_stage_map
  -- para que a Etapa 2 recrie do zero
  DELETE FROM sm_etapa_stage_map;
  DELETE FROM sm_funil_pipeline_map;

  RAISE NOTICE '✅ Limpeza de pipelines SM concluída. Comercial preservado.';
END $$;