
-- Configurações globais de notificação por tenant
CREATE TABLE public.notification_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Tipos de notificação
  notify_new_lead BOOLEAN NOT NULL DEFAULT true,
  notify_new_orcamento BOOLEAN NOT NULL DEFAULT true,
  notify_wa_message BOOLEAN NOT NULL DEFAULT true,
  notify_lead_idle BOOLEAN NOT NULL DEFAULT true,
  notify_conversation_idle BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Um config por tenant
  CONSTRAINT notification_config_tenant_unique UNIQUE (tenant_id)
);

-- Index
CREATE INDEX idx_notification_config_tenant ON public.notification_config(tenant_id);

-- RLS
ALTER TABLE public.notification_config ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado do tenant pode ler
CREATE POLICY "Tenant members can view notification config"
  ON public.notification_config FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- Somente admins podem modificar
CREATE POLICY "Admins can manage notification config"
  ON public.notification_config FOR ALL
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Trigger de updated_at
CREATE TRIGGER update_notification_config_updated_at
  BEFORE UPDATE ON public.notification_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário
COMMENT ON TABLE public.notification_config IS 'Configurações globais de notificação por tenant. Controla quais tipos de eventos geram push notifications.';
