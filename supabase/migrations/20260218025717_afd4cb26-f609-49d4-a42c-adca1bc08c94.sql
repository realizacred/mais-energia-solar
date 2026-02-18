
-- Cache table for AI-generated conversation summaries
-- Only regenerate when new messages arrive after the cached summary
CREATE TABLE public.wa_conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  summary_json JSONB NOT NULL DEFAULT '{}',
  last_message_id UUID NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Enable RLS
ALTER TABLE public.wa_conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant isolation for wa_conversation_summaries"
  ON public.wa_conversation_summaries
  FOR ALL
  USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1))
  WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1));

-- Index for fast lookup
CREATE INDEX idx_wa_conversation_summaries_conv ON public.wa_conversation_summaries(conversation_id);

-- Trigger for updated_at
CREATE TRIGGER update_wa_conversation_summaries_updated_at
  BEFORE UPDATE ON public.wa_conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
