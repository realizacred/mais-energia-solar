
-- ====================================================
-- WHATSAPP CONVERSATIONS (Inbox)
-- ====================================================
CREATE TABLE public.whatsapp_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  cliente_nome text,
  cliente_telefone text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | pending | resolved
  assigned_to uuid, -- user_id
  last_message_at timestamp with time zone DEFAULT now(),
  last_message_preview text,
  lead_id uuid REFERENCES public.leads(id),
  canal text NOT NULL DEFAULT 'whatsapp',
  unread_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage conversations"
ON public.whatsapp_conversations FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Vendors read assigned conversations"
ON public.whatsapp_conversations FOR SELECT
USING (assigned_to = auth.uid());

CREATE POLICY "Vendors update assigned conversations"
ON public.whatsapp_conversations FOR UPDATE
USING (assigned_to = auth.uid());

CREATE INDEX idx_wc_status ON public.whatsapp_conversations(status);
CREATE INDEX idx_wc_assigned ON public.whatsapp_conversations(assigned_to, status);
CREATE INDEX idx_wc_phone ON public.whatsapp_conversations(cliente_telefone);
CREATE INDEX idx_wc_last_msg ON public.whatsapp_conversations(last_message_at DESC);

CREATE TRIGGER update_wc_updated_at
BEFORE UPDATE ON public.whatsapp_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.whatsapp_conversations IS 'Conversas WhatsApp inbox — central de atendimento';

-- ====================================================
-- WHATSAPP CONVERSATION MESSAGES
-- ====================================================
CREATE TABLE public.whatsapp_conversation_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'in', -- in | out
  message_type text NOT NULL DEFAULT 'text', -- text | image | audio | video | document
  content text,
  media_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by_user_id uuid,
  is_internal_note boolean NOT NULL DEFAULT false
);

ALTER TABLE public.whatsapp_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage conversation messages"
ON public.whatsapp_conversation_messages FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Vendors read messages of assigned conversations"
ON public.whatsapp_conversation_messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE assigned_to = auth.uid()
  )
);

CREATE POLICY "Vendors insert messages in assigned conversations"
ON public.whatsapp_conversation_messages FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE assigned_to = auth.uid()
  )
);

CREATE INDEX idx_wcm_conversation ON public.whatsapp_conversation_messages(conversation_id, created_at);

COMMENT ON TABLE public.whatsapp_conversation_messages IS 'Mensagens individuais de cada conversa WhatsApp';

-- ====================================================
-- WHATSAPP TAGS
-- ====================================================
CREATE TABLE public.whatsapp_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tags"
ON public.whatsapp_tags FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated read tags"
ON public.whatsapp_tags FOR SELECT
USING (true);

COMMENT ON TABLE public.whatsapp_tags IS 'Tags de classificação para conversas WhatsApp';

-- ====================================================
-- WHATSAPP CONVERSATION TAGS (M:N)
-- ====================================================
CREATE TABLE public.whatsapp_conversation_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.whatsapp_tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, tag_id)
);

ALTER TABLE public.whatsapp_conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage conversation tags"
ON public.whatsapp_conversation_tags FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Vendors read tags of assigned conversations"
ON public.whatsapp_conversation_tags FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.whatsapp_conversations WHERE assigned_to = auth.uid()
  )
);

CREATE INDEX idx_wct_conversation ON public.whatsapp_conversation_tags(conversation_id);

-- ====================================================
-- WHATSAPP TRANSFERS (Audit trail)
-- ====================================================
CREATE TABLE public.whatsapp_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  from_user_id uuid,
  to_user_id uuid,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage transfers"
ON public.whatsapp_transfers FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Vendors read own transfers"
ON public.whatsapp_transfers FOR SELECT
USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE INDEX idx_wt_conversation ON public.whatsapp_transfers(conversation_id, created_at DESC);

COMMENT ON TABLE public.whatsapp_transfers IS 'Histórico de transferências entre atendentes';
