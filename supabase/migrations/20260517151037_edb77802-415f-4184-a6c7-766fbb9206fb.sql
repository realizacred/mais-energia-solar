CREATE TABLE IF NOT EXISTS public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  canal TEXT NOT NULL, -- 'email' | 'whatsapp' | 'push' | 'inapp'
  destinatario TEXT NOT NULL, -- 'cliente' | 'consultor' | 'gerente' | 'admin'
  template_mensagem TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view notification rules of their tenant"
ON public.notification_rules
FOR SELECT
USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

CREATE POLICY "Admins can manage notification rules of their tenant"
ON public.notification_rules
FOR ALL
USING (auth.jwt() ->> 'tenant_id' = tenant_id::text);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_rules_updated_at
    BEFORE UPDATE ON public.notification_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some default rules if possible (optional, but good for starting)
-- We'll leave it empty for now as requested.
