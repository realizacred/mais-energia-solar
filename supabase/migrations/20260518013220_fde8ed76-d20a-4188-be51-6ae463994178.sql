-- Add webhook support to pipeline_automations
ALTER TABLE public.pipeline_automations 
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS webhook_headers JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS canal_notificacao TEXT DEFAULT 'sistema', -- 'sistema', 'whatsapp', 'email'
  ADD COLUMN IF NOT EXISTS template_mensagem TEXT;

-- Add legacy funnel support
ALTER TABLE public.pipeline_automations 
  ADD COLUMN IF NOT EXISTS projeto_funil_id UUID REFERENCES public.projeto_funis(id),
  ADD COLUMN IF NOT EXISTS projeto_etapa_id UUID REFERENCES public.projeto_etapas(id);

-- Create table for automatic message configuration
CREATE TABLE IF NOT EXISTS public.automation_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    gatilho TEXT NOT NULL, 
    canal TEXT NOT NULL DEFAULT 'whatsapp',
    template TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, gatilho, canal)
);

-- Enable RLS
ALTER TABLE public.automation_message_templates ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies based on profiles table
CREATE POLICY "Users can view their tenant templates" 
    ON public.automation_message_templates 
    FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = automation_message_templates.tenant_id));

CREATE POLICY "Admins can manage their tenant templates" 
    ON public.automation_message_templates 
    FOR ALL 
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.tenant_id = automation_message_templates.tenant_id AND (p.settings->>'role' = 'admin' OR p.status = 'admin')));

-- Trigger for updated_at
CREATE TRIGGER update_automation_message_templates_updated_at
    BEFORE UPDATE ON public.automation_message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();