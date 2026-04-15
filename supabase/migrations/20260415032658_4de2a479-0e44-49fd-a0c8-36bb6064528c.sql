
-- Function: auto-sync deal stage in Comercial pipeline based on proposal status
CREATE OR REPLACE FUNCTION public.sync_deal_stage_on_proposal_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal_id uuid;
  v_pipeline_id uuid;
  v_target_stage_id uuid;
  v_target_position int;
  v_current_position int;
  v_proposal_status text;
  v_stage_name text;
BEGIN
  -- Only act on status changes
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only act if proposal is linked to a project
  IF NEW.projeto_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_proposal_status := NEW.status;

  -- Map proposal status to target stage name in Comercial pipeline
  CASE v_proposal_status
    WHEN 'gerada' THEN v_stage_name := 'Enviar Proposta';
    WHEN 'enviada' THEN v_stage_name := 'Proposta enviada';
    WHEN 'vista' THEN v_stage_name := 'Negociação';
    WHEN 'aceita' THEN v_stage_name := 'Ganho';
    WHEN 'recusada' THEN v_stage_name := 'Perdido';
    WHEN 'cancelada' THEN v_stage_name := 'Perdido';
    ELSE RETURN NEW; -- No mapping for other statuses
  END CASE;

  -- Find the deal linked to this project
  SELECT id, pipeline_id INTO v_deal_id, v_pipeline_id
  FROM deals
  WHERE projeto_id = NEW.projeto_id
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the target stage in the deal's pipeline
  SELECT id, position INTO v_target_stage_id, v_target_position
  FROM pipeline_stages
  WHERE pipeline_id = v_pipeline_id AND name = v_stage_name
  LIMIT 1;

  IF v_target_stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current stage position
  SELECT ps.position INTO v_current_position
  FROM deals d
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  WHERE d.id = v_deal_id;

  -- Only advance (never go backwards), EXCEPT for terminal states (aceita/recusada/cancelada)
  IF v_current_position IS NOT NULL 
     AND v_target_position <= v_current_position 
     AND v_proposal_status NOT IN ('aceita', 'recusada', 'cancelada') THEN
    RETURN NEW;
  END IF;

  -- Update the deal stage
  UPDATE deals
  SET stage_id = v_target_stage_id
  WHERE id = v_deal_id;

  RETURN NEW;
END;
$$;

-- Create trigger on propostas_nativas
DROP TRIGGER IF EXISTS trg_sync_deal_stage_on_proposal_status ON propostas_nativas;
CREATE TRIGGER trg_sync_deal_stage_on_proposal_status
  AFTER UPDATE OF status ON propostas_nativas
  FOR EACH ROW
  EXECUTE FUNCTION sync_deal_stage_on_proposal_status();
