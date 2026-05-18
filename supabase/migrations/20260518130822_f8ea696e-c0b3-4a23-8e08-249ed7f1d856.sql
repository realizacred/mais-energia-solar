CREATE OR REPLACE FUNCTION public.trigger_check_automations()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_automation RECORD;
  v_projeto_id UUID;
  v_tenant_id UUID;
  v_trigger_data JSONB;
BEGIN
  -- Identificar tenant e projeto base
  IF TG_TABLE_NAME = 'projetos' THEN
    v_projeto_id := NEW.id;
    v_tenant_id := NEW.tenant_id;
    v_trigger_data := jsonb_build_object(
      'projeto_id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'etapa_anterior_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.etapa_id ELSE NULL END,
      'etapa_nova_id', NEW.etapa_id,
      'funil_id', NEW.funil_id,
      'evento', TG_OP,
      'status', NEW.status,
      'status_anterior', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      'status_novo', NEW.status
    );
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    -- Tasks podem estar relacionadas a projetos
    v_projeto_id := CASE WHEN NEW.related_type = 'projeto' THEN NEW.related_id ELSE NULL END;
    v_tenant_id := NEW.tenant_id;
    v_trigger_data := jsonb_build_object(
      'projeto_id', v_projeto_id,
      'tenant_id', NEW.tenant_id,
      'task_id', NEW.id,
      'titulo', NEW.title,
      'status', NEW.status,
      'evento', TG_OP
    );
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
  END IF;

  IF v_tenant_id IS NULL THEN RETURN NEW; END IF;

  FOR v_automation IN
    SELECT pa.id
    FROM pipeline_automations pa
    WHERE pa.tenant_id = v_tenant_id
      AND pa.ativo = true
      AND (
        -- Gatilho: projeto movido
        (
          pa.tipo_gatilho = 'projeto_movido'
          AND TG_TABLE_NAME = 'projetos'
          AND pa.projeto_funil_id = NEW.funil_id
          AND (pa.projeto_etapa_id IS NULL OR pa.projeto_etapa_id = NEW.etapa_id)
          AND (TG_OP = 'INSERT' OR OLD.etapa_id IS DISTINCT FROM NEW.etapa_id)
        )
        OR
        -- Gatilho: projeto criado
        (
          pa.tipo_gatilho = 'projeto_criado'
          AND TG_TABLE_NAME = 'projetos'
          AND TG_OP = 'INSERT'
        )
        OR
        -- Gatilho: projeto ganho
        (
          pa.tipo_gatilho = 'projeto_ganho'
          AND TG_TABLE_NAME = 'projetos'
          AND NEW.status::text IN ('ganho', 'won', 'aprovado')
          AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text)
        )
        OR
        -- Gatilho: projeto perdido
        (
          pa.tipo_gatilho = 'projeto_perdido'
          AND TG_TABLE_NAME = 'projetos'
          AND NEW.status::text IN ('perdido', 'lost', 'cancelado', 'inativo')
          AND (TG_OP = 'INSERT' OR OLD.status::text IS DISTINCT FROM NEW.status::text)
        )
        OR
        -- Gatilho: atividade criada
        (
          pa.tipo_gatilho = 'atividade_criada'
          AND TG_TABLE_NAME = 'tasks'
          AND TG_OP = 'INSERT'
        )
        OR
        -- Gatilho: atividade concluída
        (
          pa.tipo_gatilho = 'atividade_concluida'
          AND TG_TABLE_NAME = 'tasks'
          AND NEW.status::text IN ('completed', 'concluida', 'concluido', 'done')
          AND (TG_OP = 'UPDATE' AND OLD.status::text IS DISTINCT FROM NEW.status::text)
        )
        OR
        -- Gatilho: cliente criado
        (
          pa.tipo_gatilho = 'cliente_criado'
          AND TG_TABLE_NAME = 'clientes'
          AND TG_OP = 'INSERT'
        )
        OR
        -- Gatilho: cliente alterado
        (
          pa.tipo_gatilho = 'cliente_alterado'
          AND TG_TABLE_NAME = 'clientes'
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
  
  RETURN NEW;
END;
$function$
;