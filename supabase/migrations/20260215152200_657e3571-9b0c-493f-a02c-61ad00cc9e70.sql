
-- Table to log all follow-up actions and outcomes for AI learning
CREATE TABLE public.wa_followup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id),
  rule_id UUID REFERENCES public.wa_followup_rules(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES public.wa_followup_queue(id) ON DELETE SET NULL,
  
  -- Action tracking
  action TEXT NOT NULL, -- 'sent', 'ai_approved', 'ai_rejected', 'ai_timeout', 'manual_review', 'responded', 'converted', 'failed'
  
  -- AI gate details
  ai_confidence INTEGER,
  ai_reason TEXT,
  ai_model TEXT,
  
  -- Message details
  mensagem_original TEXT,
  mensagem_enviada TEXT,
  
  -- Context
  cenario TEXT,
  tentativa INTEGER DEFAULT 1,
  assigned_to UUID,
  
  -- Outcome tracking (updated later)
  responded_at TIMESTAMPTZ,
  response_time_minutes INTEGER,
  led_to_conversion BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX idx_wa_followup_logs_tenant ON public.wa_followup_logs(tenant_id);
CREATE INDEX idx_wa_followup_logs_conversation ON public.wa_followup_logs(conversation_id);
CREATE INDEX idx_wa_followup_logs_action ON public.wa_followup_logs(action);
CREATE INDEX idx_wa_followup_logs_created ON public.wa_followup_logs(created_at DESC);
CREATE INDEX idx_wa_followup_logs_tenant_action ON public.wa_followup_logs(tenant_id, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.wa_followup_logs ENABLE ROW LEVEL SECURITY;

-- Policies: admins can read logs for their tenant
CREATE POLICY "Users can view their tenant followup logs"
  ON public.wa_followup_logs FOR SELECT
  USING (tenant_id = get_user_tenant_id());

-- No direct insert/update from frontend - only via edge functions with service_role
CREATE POLICY "Service role can manage followup logs"
  ON public.wa_followup_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add metric label for plan limits
-- Feature flag: ai_followup (boolean) controls access to AI-powered follow-ups
INSERT INTO public.plan_features (plan_id, feature_key, enabled)
SELECT p.id, 'ai_followup', 
  CASE WHEN p.code IN ('pro', 'enterprise') THEN true ELSE false END
FROM public.plans p
ON CONFLICT DO NOTHING;

-- Cleanup old logs (> 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_wa_followup_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM wa_followup_logs WHERE created_at < now() - interval '90 days';
END;
$$;
