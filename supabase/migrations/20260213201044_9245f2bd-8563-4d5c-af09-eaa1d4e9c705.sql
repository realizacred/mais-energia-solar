
-- ============================================================
-- FASE 2b prep: idempotency constraint + expand status enum
-- ============================================================

-- 1) Drop old CHECK constraint and add expanded one
ALTER TABLE wa_followup_queue DROP CONSTRAINT IF EXISTS wa_followup_queue_status_check;

ALTER TABLE wa_followup_queue ADD CONSTRAINT wa_followup_queue_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'pendente_revisao'::text,
    'enviado'::text,
    'respondido'::text,
    'cancelado'::text,
    'expirado'::text,
    'bloqueado_ia'::text,
    'falhou'::text
  ]));

-- 2) Unique constraint for idempotency: one pending/active followup per (conversation, rule, tentativa)
--    Uses partial index to only enforce on active states
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_followup_queue_idempotent
  ON wa_followup_queue (conversation_id, rule_id, tentativa)
  WHERE status IN ('pendente', 'pendente_revisao', 'enviado');
