CREATE OR REPLACE FUNCTION public.trigger_check_automations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_automation RECORD;
  v_projeto_id UUID;
  v_tenant_id UUID;
  v_trigger_data JSONB;
  v_funil_id UUID;
  v_etapa_nova_id UUID;
  v_etapa_anterior_id UUID;
  v_status_novo TEXT;
  v_status_anterior TEXT;
BEGIN
  -- A função é compartilhada por projetos, clientes e tasks.
  -- Nunca acessar NEW.funil_id / NEW.etapa_id / NEW.status fora do ramo de projetos,
  -- pois clientes/tasks não possuem esses campos e o trigger falha em runtime.
  IF TG_TABLE_NAME = 'projetos' THEN
    v_projeto_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_funil_id := NEW.funil_id;
    v_etapa_nova_id := NEW.etapa_id;
    v_status_novo := NEW.status::text;

    IF TG_OP = 'UPDATE' THEN
      v_etapa_anterior_id := OLD.etapa_id;
      v_status_anterior := OLD.status::text;
    END IF;

    v_trigger_data := jsonb_build_object(
      'projeto_id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'etapa_anterior_id', v_etapa_anterior_id,
      'etapa_nova_id', v_etapa_nova_id,
      'funil_id', v_funil_id,
      'evento', TG_OP,
      'status', v_status_novo,
      'status_anterior', v_status_anterior,
      'status_novo', v_status_novo
    );

    FOR v_automation IN
      SELECT pa.id
      FROM public.pipeline_automations pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.ativo = true
        AND (
          (
            pa.tipo_gatilho = 'projeto_movido'
            AND pa.projeto_funil_id = v_funil_id
            AND (pa.projeto_etapa_id IS NULL OR pa.projeto_etapa_id = v_etapa_nova_id)
            AND (TG_OP = 'INSERT' OR v_etapa_anterior_id IS DISTINCT FROM v_etapa_nova_id)
          )
          OR (
            pa.tipo_gatilho = 'projeto_criado'
            AND TG_OP = 'INSERT'
          )
          OR (
            pa.tipo_gatilho = 'projeto_ganho'
            AND v_status_novo IN ('ganho', 'won', 'aprovado')
            AND (TG_OP = 'INSERT' OR v_status_anterior IS DISTINCT FROM v_status_novo)
          )
          OR (
            pa.tipo_gatilho = 'projeto_perdido'
            AND v_status_novo IN ('perdido', 'lost', 'cancelado', 'inativo')
            AND (TG_OP = 'INSERT' OR v_status_anterior IS DISTINCT FROM v_status_novo)
          )
        )
    LOOP
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/pipeline-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'automation_id', v_automation.id,
          'trigger_data', v_trigger_data
        )::text
      );
    END LOOP;

  ELSIF TG_TABLE_NAME = 'tasks' THEN
    v_projeto_id := CASE WHEN NEW.related_type = 'projeto' THEN NEW.related_id ELSE NULL END;
    v_tenant_id := NEW.tenant_id;
    v_status_novo := NEW.status::text;

    IF TG_OP = 'UPDATE' THEN
      v_status_anterior := OLD.status::text;
    END IF;

    v_trigger_data := jsonb_build_object(
      'projeto_id', v_projeto_id,
      'tenant_id', NEW.tenant_id,
      'task_id', NEW.id,
      'titulo', NEW.title,
      'status', v_status_novo,
      'evento', TG_OP
    );

    FOR v_automation IN
      SELECT pa.id
      FROM public.pipeline_automations pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.ativo = true
        AND (
          (
            pa.tipo_gatilho = 'atividade_criada'
            AND TG_OP = 'INSERT'
          )
          OR (
            pa.tipo_gatilho = 'atividade_concluida'
            AND v_status_novo IN ('completed', 'concluida', 'concluido', 'done')
            AND TG_OP = 'UPDATE'
            AND v_status_anterior IS DISTINCT FROM v_status_novo
          )
        )
    LOOP
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/pipeline-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'automation_id', v_automation.id,
          'trigger_data', v_trigger_data
        )::text
      );
    END LOOP;

  ELSIF TG_TABLE_NAME = 'clientes' THEN
    v_tenant_id := NEW.tenant_id;
    v_trigger_data := jsonb_build_object(
      'cliente_id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'nome', NEW.nome,
      'email', NEW.email,
      'telefone', NEW.telefone,
      'evento', TG_OP
    );

    FOR v_automation IN
      SELECT pa.id
      FROM public.pipeline_automations pa
      WHERE pa.tenant_id = v_tenant_id
        AND pa.ativo = true
        AND (
          (
            pa.tipo_gatilho = 'cliente_criado'
            AND TG_OP = 'INSERT'
          )
          OR (
            pa.tipo_gatilho = 'cliente_alterado'
            AND TG_OP = 'UPDATE'
          )
        )
    LOOP
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/pipeline-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'automation_id', v_automation.id,
          'trigger_data', v_trigger_data
        )::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;