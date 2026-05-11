-- Add expires_at column to proposta_aceite_tokens
ALTER TABLE public.proposta_aceite_tokens 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- Populate existing rows where expires_at is null
UPDATE public.proposta_aceite_tokens 
SET expires_at = created_at + interval '30 days' 
WHERE expires_at IS NULL;