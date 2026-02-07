-- Função para disparar automação de boas-vindas quando um novo lead é criado
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_welcome()
RETURNS TRIGGER AS $$
BEGIN
  -- Dispara a edge function de automação via pg_net
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-whatsapp-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'tipo', 'boas_vindas',
      'lead_id', NEW.id,
      'lead_data', jsonb_build_object(
        'id', NEW.id,
        'nome', NEW.nome,
        'telefone', NEW.telefone,
        'cidade', NEW.cidade,
        'estado', NEW.estado,
        'media_consumo', NEW.media_consumo,
        'vendedor', NEW.vendedor,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para disparar automação quando status do lead muda
CREATE OR REPLACE FUNCTION public.trigger_whatsapp_status_change()
RETURNS TRIGGER AS $$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
BEGIN
  -- Busca nomes dos status
  IF OLD.status_id IS NOT NULL THEN
    SELECT nome INTO old_status_name FROM public.lead_status WHERE id = OLD.status_id;
  END IF;
  
  IF NEW.status_id IS NOT NULL THEN
    SELECT nome INTO new_status_name FROM public.lead_status WHERE id = NEW.status_id;
  END IF;
  
  -- Só dispara se o status realmente mudou
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-whatsapp-automations',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'tipo', 'mudanca_status',
        'lead_id', NEW.id,
        'status_anterior', old_status_name,
        'status_novo', new_status_name,
        'lead_data', jsonb_build_object(
          'id', NEW.id,
          'nome', NEW.nome,
          'telefone', NEW.telefone,
          'cidade', NEW.cidade,
          'estado', NEW.estado,
          'media_consumo', NEW.media_consumo,
          'vendedor', NEW.vendedor,
          'ultimo_contato', NEW.ultimo_contato,
          'created_at', NEW.created_at
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para boas-vindas em novos leads
DROP TRIGGER IF EXISTS trigger_lead_welcome_whatsapp ON public.leads;
CREATE TRIGGER trigger_lead_welcome_whatsapp
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_whatsapp_welcome();

-- Trigger para mudança de status
DROP TRIGGER IF EXISTS trigger_lead_status_change_whatsapp ON public.leads;
CREATE TRIGGER trigger_lead_status_change_whatsapp
  AFTER UPDATE OF status_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_whatsapp_status_change();