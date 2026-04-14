-- Backfill: move deals from "Recebido" to correct stage based on deal status
-- Only affects deals with import_source = 'solar_market' stuck in position 0

DO $$
DECLARE
  v_comercial_id uuid;
  v_fechado_id uuid;
  v_proposta_enviada_id uuid;
  v_qualificado_id uuid;
BEGIN
  -- Get Comercial pipeline
  SELECT id INTO v_comercial_id FROM pipelines WHERE is_default = true LIMIT 1;
  IF v_comercial_id IS NULL THEN RAISE NOTICE 'No default pipeline found'; RETURN; END IF;

  -- Get target stages
  SELECT id INTO v_fechado_id FROM pipeline_stages WHERE pipeline_id = v_comercial_id AND name = 'Fechado' LIMIT 1;
  SELECT id INTO v_proposta_enviada_id FROM pipeline_stages WHERE pipeline_id = v_comercial_id AND name = 'Proposta enviada' LIMIT 1;
  SELECT id INTO v_qualificado_id FROM pipeline_stages WHERE pipeline_id = v_comercial_id AND name = 'Qualificado' LIMIT 1;

  -- Move won deals to Fechado
  IF v_fechado_id IS NOT NULL THEN
    UPDATE deals SET stage_id = v_fechado_id
    WHERE pipeline_id = v_comercial_id
      AND status = 'won'
      AND import_source = 'solar_market'
      AND stage_id = (SELECT id FROM pipeline_stages WHERE pipeline_id = v_comercial_id AND position = 0 LIMIT 1);
  END IF;

  -- Move open deals that have propostas with status 'enviada' or 'gerada' to Proposta enviada
  IF v_proposta_enviada_id IS NOT NULL THEN
    UPDATE deals SET stage_id = v_proposta_enviada_id
    WHERE pipeline_id = v_comercial_id
      AND status = 'open'
      AND import_source = 'solar_market'
      AND stage_id = (SELECT id FROM pipeline_stages WHERE pipeline_id = v_comercial_id AND position = 0 LIMIT 1)
      AND id IN (
        SELECT DISTINCT pn.deal_id FROM propostas_nativas pn
        WHERE pn.status IN ('enviada', 'gerada', 'vista')
      );
  END IF;

  RAISE NOTICE 'Backfill complete: comercial=%, fechado=%, proposta_enviada=%', v_comercial_id, v_fechado_id, v_proposta_enviada_id;
END $$;