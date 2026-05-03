ALTER TABLE public.proposta_aceite_tokens
  ADD COLUMN IF NOT EXISTS snapshot_hash text,
  ADD COLUMN IF NOT EXISTS aceite_payload_hash text;