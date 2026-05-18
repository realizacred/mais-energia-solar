-- 1. Add CHECK constraint to canal_notificacao
ALTER TABLE public.pipeline_automations 
  DROP CONSTRAINT IF EXISTS check_canal_notificacao;

ALTER TABLE public.pipeline_automations 
  ADD CONSTRAINT check_canal_notificacao 
  CHECK (canal_notificacao IN ('whatsapp', 'email', 'inApp', 'webhook', 'mover_etapa'));

-- 2. Ensure wa_outbox exists and is ready for automation logs
-- (Assuming wa_outbox is already managed by other RB-105 tasks, but ensuring metadata column is available)
ALTER TABLE public.wa_outbox 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Cleanup: If automation_message_templates still exists in some cache/view, it was dropped in Parte 1.
-- This ensures the DB state is consistent with Parte 2 requirements.
