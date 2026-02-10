-- Table to store per-user conversation preferences (mute/hide)
CREATE TABLE public.wa_conversation_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  tenant_id UUID DEFAULT get_user_tenant_id() REFERENCES tenants(id),
  muted BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE public.wa_conversation_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users manage own conversation preferences"
ON public.wa_conversation_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid() AND tenant_id = get_user_tenant_id())
WITH CHECK (user_id = auth.uid() AND tenant_id = get_user_tenant_id());

-- Timestamp trigger
CREATE TRIGGER update_wa_conversation_preferences_updated_at
BEFORE UPDATE ON public.wa_conversation_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_wa_conv_prefs_user ON public.wa_conversation_preferences(user_id, tenant_id);

COMMENT ON TABLE public.wa_conversation_preferences IS 'Per-user preferences for WhatsApp conversations (mute/hide). Tenant-isolated.';