-- Phase 2 hardening: audit metadata + concurrency guard
ALTER TABLE public.proposal_followup_attempts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Prevent concurrent duplicate attempts (double-click) for the same proposal/channel/attempt_number
CREATE UNIQUE INDEX IF NOT EXISTS uq_pfa_proposta_channel_attempt
  ON public.proposal_followup_attempts (tenant_id, proposta_id, channel, attempt_number);