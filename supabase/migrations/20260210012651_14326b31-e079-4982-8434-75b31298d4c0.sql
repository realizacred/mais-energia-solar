
-- Add missing columns to existing push_subscriptions
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Make tenant_id NOT NULL (it was nullable)
ALTER TABLE public.push_subscriptions ALTER COLUMN tenant_id SET NOT NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_tenant ON public.push_subscriptions(tenant_id, is_active);

-- Ensure RLS is enabled
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any, then recreate
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins can view tenant subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view tenant subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id());

-- =============================================
-- Push preferences per user
-- =============================================
CREATE TABLE public.push_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.push_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own preferences" ON public.push_preferences FOR INSERT WITH CHECK (auth.uid() = user_id AND tenant_id = get_user_tenant_id());
CREATE POLICY "Users can update own preferences" ON public.push_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_push_preferences_updated_at
  BEFORE UPDATE ON public.push_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Muted conversations
-- =============================================
CREATE TABLE public.push_muted_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

ALTER TABLE public.push_muted_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own mutes" ON public.push_muted_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND tenant_id = get_user_tenant_id());

-- =============================================
-- Push dedup log (service_role only)
-- =============================================
CREATE TABLE public.push_sent_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  subscription_id UUID NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, subscription_id)
);

CREATE INDEX idx_push_sent_log_sent ON public.push_sent_log(sent_at);
ALTER TABLE public.push_sent_log ENABLE ROW LEVEL SECURITY;
