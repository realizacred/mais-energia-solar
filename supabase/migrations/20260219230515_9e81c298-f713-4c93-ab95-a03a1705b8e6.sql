
-- ============================================
-- INTERNAL CHAT SYSTEM (Team-only messaging)
-- Completely isolated from WhatsApp engine
-- ============================================

-- Chat conversations between team members (1:1 or group)
CREATE TABLE public.internal_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  chat_type TEXT NOT NULL DEFAULT 'direct' CHECK (chat_type IN ('direct', 'group')),
  name TEXT, -- NULL for direct chats, required for groups
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_chats_tenant ON public.internal_chats(tenant_id);

-- Chat members
CREATE TABLE public.internal_chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_internal_chat_members_user ON public.internal_chat_members(user_id, tenant_id);
CREATE INDEX idx_internal_chat_members_chat ON public.internal_chat_members(chat_id);

-- Messages in internal chats
CREATE TABLE public.internal_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.internal_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_internal_chat_messages_chat ON public.internal_chat_messages(chat_id, created_at DESC);
CREATE INDEX idx_internal_chat_messages_tenant ON public.internal_chat_messages(tenant_id);

-- Enable RLS
ALTER TABLE public.internal_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_messages;

-- RLS: Users can only see chats they are members of, within their tenant
CREATE POLICY "Members can view their chats"
  ON public.internal_chats FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_members
      WHERE chat_id = internal_chats.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create chats"
  ON public.internal_chats FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Members
CREATE POLICY "Members can view chat members"
  ON public.internal_chat_members FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_members m2
      WHERE m2.chat_id = internal_chat_members.chat_id AND m2.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can add members"
  ON public.internal_chat_members FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Members can update their own read status"
  ON public.internal_chat_members FOR UPDATE
  USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id(auth.uid()));

-- Messages
CREATE POLICY "Members can view messages in their chats"
  ON public.internal_chat_messages FOR SELECT
  USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_members
      WHERE chat_id = internal_chat_messages.chat_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages to their chats"
  ON public.internal_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND tenant_id = get_user_tenant_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.internal_chat_members
      WHERE chat_id = internal_chat_messages.chat_id AND user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_internal_chats_updated_at
  BEFORE UPDATE ON public.internal_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
