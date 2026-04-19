
-- Saneamento: remover pipeline duplicado por typo "Compesação"
-- tenant: 17de8315-2e2f-4a79-8751-e5d507d69a41
-- Validação prévia (em read_query) confirmou:
--   - 0 deals, 0 projetos, 0 automações apontando para as 3 stages do typo
--   - 0 entradas em deal_kanban_projection
--   - pipeline canônico "Compensação" (fc69d3fe...) preservado
DO $$
DECLARE
  v_typo_pipeline uuid := 'aceb2e14-7fca-4963-a544-7bbe4977846a';
  v_tenant uuid := '17de8315-2e2f-4a79-8751-e5d507d69a41';
  v_refs int;
BEGIN
  -- Guard defensivo: aborta se qualquer referência apareceu entre a leitura e a execução
  SELECT
    (SELECT count(*) FROM deals WHERE pipeline_id = v_typo_pipeline) +
    (SELECT count(*) FROM projetos WHERE funil_id = v_typo_pipeline) +
    (SELECT count(*) FROM deals d JOIN pipeline_stages s ON s.id = d.stage_id WHERE s.pipeline_id = v_typo_pipeline) +
    (SELECT count(*) FROM projetos pr JOIN pipeline_stages s ON s.id = pr.etapa_id WHERE s.pipeline_id = v_typo_pipeline) +
    (SELECT count(*) FROM pipeline_automations WHERE pipeline_id = v_typo_pipeline)
  INTO v_refs;

  IF v_refs > 0 THEN
    RAISE EXCEPTION 'Aborting cleanup: % residual references to typo pipeline', v_refs;
  END IF;

  DELETE FROM pipeline_stages WHERE pipeline_id = v_typo_pipeline;
  DELETE FROM pipelines WHERE id = v_typo_pipeline AND tenant_id = v_tenant;
END $$;
