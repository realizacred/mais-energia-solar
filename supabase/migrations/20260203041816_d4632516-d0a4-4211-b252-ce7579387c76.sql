-- Create a table to store webhook configurations
CREATE TABLE public.webhook_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  eventos TEXT[] NOT NULL DEFAULT ARRAY['INSERT'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage webhooks"
ON public.webhook_config
FOR ALL
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_config_updated_at
BEFORE UPDATE ON public.webhook_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add follow-up tracking columns to leads
ALTER TABLE public.leads 
ADD COLUMN ultimo_contato TIMESTAMP WITH TIME ZONE,
ADD COLUMN proxima_acao TEXT,
ADD COLUMN data_proxima_acao DATE;

-- Create function to call webhook on lead changes
CREATE OR REPLACE FUNCTION public.notify_webhook_on_lead_change()
RETURNS TRIGGER AS $$
DECLARE
  webhook_record RECORD;
  payload JSONB;
BEGIN
  -- Build the payload
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END,
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );
  
  -- Call the edge function for each active webhook that matches the event
  FOR webhook_record IN 
    SELECT url FROM public.webhook_config 
    WHERE ativo = true AND TG_OP = ANY(eventos)
  LOOP
    PERFORM net.http_post(
      url := webhook_record.url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := payload
    );
  END LOOP;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on leads table
CREATE TRIGGER leads_webhook_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.notify_webhook_on_lead_change();