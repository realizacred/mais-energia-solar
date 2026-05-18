-- Function to check and trigger automations
CREATE OR REPLACE FUNCTION public.trigger_check_automations()
RETURNS TRIGGER AS $$
DECLARE
  v_automation RECORD;
BEGIN
  -- Buscar automações ativas para este tenant que correspondam ao evento
  -- Prioridade para eventos específicos
  FOR v_automation IN
    SELECT pa.id, pa.tenant_id
    FROM pipeline_automations pa
    WHERE pa.tenant_id = NEW.tenant_id
      AND pa.ativo = true
      AND (
        -- Gatilho: projeto movido
        (
          pa.tipo_gatilho = 'projeto_movido'
          AND pa.projeto_funil_id = NEW.funil_id
          AND (pa.projeto_etapa_id IS NULL OR pa.projeto_etapa_id = NEW.etapa_id)
          AND (OLD.etapa_id IS DISTINCT FROM NEW.etapa_id OR TG_OP = 'INSERT')
        )
        OR
        -- Gatilho: projeto criado
        (
          pa.tipo_gatilho = 'projeto_criado'
          AND TG_OP = 'INSERT'
        )
        OR
        -- Gatilho: projeto ganho
        (
          pa.tipo_gatilho = 'projeto_ganho'
          AND NEW.status = 'ganho'
          AND (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'INSERT')
        )
      )
  LOOP
    -- Enfileirar execução via pg_net (assíncrono)
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/pipeline-automations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'automation_id', v_automation.id,
        'trigger_data', jsonb_build_object(
          'projeto_id', NEW.id,
          'tenant_id', NEW.tenant_id,
          'etapa_anterior_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.etapa_id ELSE NULL END,
          'etapa_nova_id', NEW.etapa_id,
          'funil_id', NEW.funil_id,
          'evento', TG_OP,
          'status', NEW.status
        )
      )::text
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on projetos table
DROP TRIGGER IF EXISTS trg_projeto_automations ON public.projetos;
CREATE TRIGGER trg_projeto_automations
  AFTER INSERT OR UPDATE OF etapa_id, status
  ON public.projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_check_automations();
