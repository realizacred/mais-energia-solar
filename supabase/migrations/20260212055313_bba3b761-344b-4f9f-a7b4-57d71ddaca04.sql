
-- =====================================================
-- Google Calendar Integration: per-user OAuth tokens
-- =====================================================

-- Table to store each user's Google Calendar OAuth tokens
CREATE TABLE public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  google_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY "Users can view own tokens"
  ON public.google_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id AND tenant_id = get_user_tenant_id());

-- Users can update their own tokens
CREATE POLICY "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Users can delete their own tokens (disconnect)
CREATE POLICY "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can view all tokens in their tenant
CREATE POLICY "Admins can view tenant tokens"
  ON public.google_calendar_tokens FOR SELECT
  USING (is_admin(auth.uid()) AND tenant_id = get_user_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger
CREATE TRIGGER audit_google_calendar_tokens
  AFTER INSERT OR UPDATE OR DELETE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();
