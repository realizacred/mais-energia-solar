-- ============================================================
-- TABELA 1: Sugestões de vínculo geradas por IA (revisão humana)
-- ============================================================
CREATE TABLE public.wa_conversation_resolution_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  suggested_entity_type TEXT CHECK (suggested_entity_type IN ('cliente','lead')),
  suggested_entity_id UUID,
  confidence NUMERIC,
  reason TEXT,
  evidence JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_res_sugg_tenant ON public.wa_conversation_resolution_suggestions(tenant_id, status, created_at DESC);
CREATE INDEX idx_wa_res_sugg_conv ON public.wa_conversation_resolution_suggestions(conversation_id);
CREATE UNIQUE INDEX uq_wa_res_sugg_pending_per_conv
  ON public.wa_conversation_resolution_suggestions(conversation_id)
  WHERE status = 'pending';

ALTER TABLE public.wa_conversation_resolution_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_res_sugg_select_tenant"
ON public.wa_conversation_resolution_suggestions FOR SELECT
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "wa_res_sugg_insert_tenant"
ON public.wa_conversation_resolution_suggestions FOR INSERT
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "wa_res_sugg_update_tenant"
ON public.wa_conversation_resolution_suggestions FOR UPDATE
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- ============================================================
-- TABELA 2: Eventos pós-resolução (sem envio automático)
-- ============================================================
CREATE TABLE public.wa_conversation_resolution_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('cliente','lead')),
  entity_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual','batch','realtime','ai_suggestion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processed','skipped','error')),
  dedupe_key TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_wa_res_events_dedupe ON public.wa_conversation_resolution_events(tenant_id, dedupe_key);
CREATE INDEX idx_wa_res_events_status ON public.wa_conversation_resolution_events(tenant_id, status, created_at DESC);

ALTER TABLE public.wa_conversation_resolution_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_res_events_select_tenant"
ON public.wa_conversation_resolution_events FOR SELECT
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "wa_res_events_insert_tenant"
ON public.wa_conversation_resolution_events FOR INSERT
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

CREATE POLICY "wa_res_events_update_tenant"
ON public.wa_conversation_resolution_events FOR UPDATE
USING (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()))
WITH CHECK (tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- ============================================================
-- TRIGGER: emite evento pós-resolução automaticamente quando
-- wa_conversations passa a ter cliente_id ou lead_id.
-- Cobre origens: manual, batch, realtime e ai_suggestion (via service-role no webhook).
-- Idempotente via dedupe_key + ON CONFLICT DO NOTHING.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_wa_emit_resolution_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
  v_dedupe TEXT;
BEGIN
  -- Identifica vínculo recém-criado
  IF NEW.cliente_id IS NOT NULL AND (OLD.cliente_id IS NULL OR OLD.cliente_id <> NEW.cliente_id) THEN
    v_entity_type := 'cliente';
    v_entity_id := NEW.cliente_id;
  ELSIF NEW.lead_id IS NOT NULL AND (OLD.lead_id IS NULL OR OLD.lead_id <> NEW.lead_id) THEN
    v_entity_type := 'lead';
    v_entity_id := NEW.lead_id;
  ELSE
    RETURN NEW;
  END IF;

  v_dedupe := 'conversation_resolved:' || NEW.id::text || ':' || v_entity_type || ':' || v_entity_id::text;

  INSERT INTO public.wa_conversation_resolution_events
    (tenant_id, conversation_id, entity_type, entity_id, source, dedupe_key, payload)
  VALUES
    (NEW.tenant_id, NEW.id, v_entity_type, v_entity_id, 'realtime', v_dedupe,
     jsonb_build_object('remote_jid', NEW.remote_jid, 'cliente_telefone', NEW.cliente_telefone))
  ON CONFLICT (tenant_id, dedupe_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca quebrar update de conversa
  RAISE WARNING '[trg_wa_emit_resolution_event] %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_conv_resolution_event ON public.wa_conversations;
CREATE TRIGGER trg_wa_conv_resolution_event
AFTER UPDATE OF cliente_id, lead_id ON public.wa_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trg_wa_emit_resolution_event();