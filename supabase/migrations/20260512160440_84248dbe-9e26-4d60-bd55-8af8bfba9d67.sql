-- Registra mudança de etapa no histórico (project_events) quando a alteração
-- ocorre via deal_pipeline_stages (qualquer funil: Comercial, Engenharia,
-- Equipamento, etc). Antes só era registrada quando deals.stage_id mudava,
-- o que não acontece na UI atual de funis múltiplos.
CREATE OR REPLACE FUNCTION public.audit_deal_pipeline_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_name text;
  v_from_stage    text;
  v_to_stage      text;
BEGIN
  -- Evita evento duplicado quando a mudança veio de UPDATE em deals
  -- (audit_deal_changes já registrou e a trigger sync_deal_primary_pipeline_membership
  -- cascateou para deal_pipeline_stages).
  IF current_setting('app.audit_trigger_active', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_pipeline_name FROM pipelines        WHERE id = NEW.pipeline_id;
  SELECT name INTO v_from_stage    FROM pipeline_stages  WHERE id = OLD.stage_id;
  SELECT name INTO v_to_stage      FROM pipeline_stages  WHERE id = NEW.stage_id;

  INSERT INTO project_events (
    tenant_id, deal_id, actor_user_id, event_type, from_value, to_value, metadata
  ) VALUES (
    NEW.tenant_id,
    NEW.deal_id,
    auth.uid(),
    'stage_changed',
    OLD.stage_id::text,
    NEW.stage_id::text,
    jsonb_build_object(
      'pipeline_id',   NEW.pipeline_id,
      'pipeline_name', v_pipeline_name,
      'from_stage',    v_from_stage,
      'to_stage',      v_to_stage,
      'source',        'deal_pipeline_stages'
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_dps_stage_change ON public.deal_pipeline_stages;
CREATE TRIGGER trg_audit_dps_stage_change
  AFTER UPDATE OF stage_id ON public.deal_pipeline_stages
  FOR EACH ROW
  WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
  EXECUTE FUNCTION public.audit_deal_pipeline_stage_change();