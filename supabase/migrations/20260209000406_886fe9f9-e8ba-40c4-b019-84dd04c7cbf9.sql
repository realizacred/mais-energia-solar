
-- ══════════════════════════════════════════════════════════
-- WhatsApp Multi-Instance (Evolution API) — Schema
-- ══════════════════════════════════════════════════════════

-- 1. wa_instances — cada vendedor/equipe pode ter sua instância
CREATE TABLE public.wa_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  evolution_instance_key TEXT UNIQUE NOT NULL,
  evolution_api_url TEXT NOT NULL DEFAULT 'https://api.evolution.local',
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  webhook_secret TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','connecting','error')),
  phone_number TEXT,
  profile_name TEXT,
  profile_picture_url TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all instances"
  ON public.wa_instances FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can view own instances"
  ON public.wa_instances FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE TRIGGER update_wa_instances_updated_at
  BEFORE UPDATE ON public.wa_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.wa_instances IS 'Instâncias WhatsApp via Evolution API, uma por vendedor/equipe';

-- 2. wa_conversations — conversas vinculadas a instâncias
CREATE TABLE public.wa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  cliente_nome TEXT,
  cliente_telefone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INT NOT NULL DEFAULT 0,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  profile_picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instance_id, remote_jid)
);

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all wa_conversations"
  ON public.wa_conversations FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can view conversations of own instances"
  ON public.wa_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wa_instances wi
      WHERE wi.id = instance_id AND wi.owner_user_id = auth.uid()
    )
    OR assigned_to = auth.uid()
  );

CREATE POLICY "Vendors can update assigned conversations"
  ON public.wa_conversations FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.wa_instances wi
      WHERE wi.id = instance_id AND wi.owner_user_id = auth.uid()
    )
  );

CREATE INDEX idx_wa_conversations_instance ON public.wa_conversations(instance_id);
CREATE INDEX idx_wa_conversations_status ON public.wa_conversations(status);
CREATE INDEX idx_wa_conversations_last_msg ON public.wa_conversations(last_message_at DESC);

CREATE TRIGGER update_wa_conversations_updated_at
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.wa_conversations IS 'Conversas WhatsApp vinculadas a instâncias Evolution API';

-- 3. wa_messages — mensagens com deduplicação
CREATE TABLE public.wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  evolution_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','audio','video','document','sticker','location','contact','reaction')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  quoted_message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
  sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_internal_note BOOLEAN NOT NULL DEFAULT false,
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending','sent','delivered','read','failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all wa_messages"
  ON public.wa_messages FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can view messages of accessible conversations"
  ON public.wa_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wa_conversations wc
      JOIN public.wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = conversation_id
        AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
    )
  );

CREATE POLICY "Vendors can insert messages on accessible conversations"
  ON public.wa_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wa_conversations wc
      JOIN public.wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = conversation_id
        AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
    )
  );

CREATE INDEX idx_wa_messages_conversation ON public.wa_messages(conversation_id, created_at);
CREATE INDEX idx_wa_messages_evolution_id ON public.wa_messages(evolution_message_id);

COMMENT ON TABLE public.wa_messages IS 'Mensagens WhatsApp com deduplicação via evolution_message_id';

-- 4. wa_webhook_events — fila de eventos inbound
CREATE TABLE public.wa_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access webhook events"
  ON public.wa_webhook_events FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_wa_webhook_events_unprocessed ON public.wa_webhook_events(processed, created_at) WHERE NOT processed;
CREATE INDEX idx_wa_webhook_events_instance ON public.wa_webhook_events(instance_id);

COMMENT ON TABLE public.wa_webhook_events IS 'Fila de eventos recebidos via webhook da Evolution API';

-- 5. wa_outbox — fila de envio confiável
CREATE TABLE public.wa_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
  remote_jid TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage outbox"
  ON public.wa_outbox FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can insert into outbox for own instances"
  ON public.wa_outbox FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wa_instances wi
      WHERE wi.id = instance_id AND wi.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can view own outbox items"
  ON public.wa_outbox FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wa_instances wi
      WHERE wi.id = instance_id AND wi.owner_user_id = auth.uid()
    )
  );

CREATE INDEX idx_wa_outbox_pending ON public.wa_outbox(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_wa_outbox_instance ON public.wa_outbox(instance_id);

CREATE TRIGGER update_wa_outbox_updated_at
  BEFORE UPDATE ON public.wa_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.wa_outbox IS 'Fila de saída para envio confiável de mensagens WhatsApp';

-- 6. wa_tags — tags para conversas multi-instância
CREATE TABLE public.wa_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wa_tags"
  ON public.wa_tags FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can view wa_tags"
  ON public.wa_tags FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 7. wa_conversation_tags — relação N:N
CREATE TABLE public.wa_conversation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.wa_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, tag_id)
);

ALTER TABLE public.wa_conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wa_conversation_tags"
  ON public.wa_conversation_tags FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can manage tags on accessible conversations"
  ON public.wa_conversation_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.wa_conversations wc
      JOIN public.wa_instances wi ON wi.id = wc.instance_id
      WHERE wc.id = conversation_id
        AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
    )
  );

-- 8. wa_transfers — histórico de transferências
CREATE TABLE public.wa_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wa_transfers"
  ON public.wa_transfers FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendors can view own transfers"
  ON public.wa_transfers FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE INDEX idx_wa_transfers_conversation ON public.wa_transfers(conversation_id);

COMMENT ON TABLE public.wa_transfers IS 'Histórico de transferências de conversas entre atendentes';

-- Cleanup function for old webhook events
CREATE OR REPLACE FUNCTION public.cleanup_wa_webhook_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM wa_webhook_events
  WHERE processed = true AND created_at < now() - interval '7 days';
  
  DELETE FROM wa_webhook_events
  WHERE processed = false AND retry_count >= 5 AND created_at < now() - interval '1 day';
END;
$$;
