-- PR-2 Follow-up por Propostas: campos de sugestão IA na fila
-- Additive, nullable, reversível. Nenhum default destrutivo.

ALTER TABLE public.wa_followup_queue
  ADD COLUMN IF NOT EXISTS mensagem_sugerida text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wa_followup_queue_proposal_pending_ai
  ON public.wa_followup_queue (tenant_id, status)
  WHERE proposta_id IS NOT NULL AND mensagem_sugerida IS NULL AND status = 'pendente_revisao';
