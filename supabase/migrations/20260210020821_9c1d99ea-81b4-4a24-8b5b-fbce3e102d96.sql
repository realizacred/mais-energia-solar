
-- Table for "Apagar para mim" persistence
CREATE TABLE public.wa_message_hidden (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

ALTER TABLE public.wa_message_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own hidden messages"
  ON public.wa_message_hidden FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can hide messages"
  ON public.wa_message_hidden FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unhide messages"
  ON public.wa_message_hidden FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_wa_message_hidden_user ON public.wa_message_hidden(user_id);
CREATE INDEX idx_wa_message_hidden_message ON public.wa_message_hidden(message_id);
