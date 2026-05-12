-- Enriquece audit_deal_changes com metadata (pipeline_name, from_stage, to_stage)
CREATE OR REPLACE FUNCTION public.audit_deal_changes()
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
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  IF OLD.pipeline_id IS DISTINCT FROM NEW.pipeline_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'pipeline_changed', OLD.pipeline_id::text, NEW.pipeline_id::text);
  END IF;

  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    SELECT name INTO v_pipeline_name FROM pipelines       WHERE id = NEW.pipeline_id;
    SELECT name INTO v_from_stage    FROM pipeline_stages WHERE id = OLD.stage_id;
    SELECT name INTO v_to_stage      FROM pipeline_stages WHERE id = NEW.stage_id;

    INSERT INTO project_events (
      tenant_id, deal_id, actor_user_id, event_type, from_value, to_value, metadata
    ) VALUES (
      NEW.tenant_id, NEW.id, auth.uid(), 'stage_changed',
      OLD.stage_id::text, NEW.stage_id::text,
      jsonb_build_object(
        'pipeline_id',   NEW.pipeline_id,
        'pipeline_name', v_pipeline_name,
        'from_stage',    v_from_stage,
        'to_stage',      v_to_stage,
        'source',        'deals'
      )
    );
  END IF;

  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'consultant_changed', OLD.owner_id::text, NEW.owner_id::text);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'status_changed', OLD.status, NEW.status);
  END IF;

  IF OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
    VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'value_changed', OLD.value::text, NEW.value::text);
  END IF;

  RETURN NEW;
END;
$function$;

-- Guard contra evento 'created' duplicado
CREATE OR REPLACE FUNCTION public.audit_deal_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.audit_trigger_active', 'true', true);

  IF EXISTS (
    SELECT 1 FROM project_events
    WHERE deal_id = NEW.id AND event_type = 'created'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO project_events (tenant_id, deal_id, actor_user_id, event_type, from_value, to_value)
  VALUES (NEW.tenant_id, NEW.id, auth.uid(), 'created', NULL, NEW.status);

  RETURN NEW;
END;
$function$;