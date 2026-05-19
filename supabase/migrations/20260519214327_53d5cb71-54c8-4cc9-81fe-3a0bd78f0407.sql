-- Add retry control columns to proposta_versoes
ALTER TABLE public.proposta_versoes 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE;

-- Add index for background workers to find pending/retrying generations
CREATE INDEX IF NOT EXISTS idx_proposta_versoes_generation_status ON public.proposta_versoes (generation_status) 
WHERE generation_status IN ('pending', 'generating', 'failed');

-- Update generation_status check constraint if exists or just ensure it accepts new values
-- (If it was a simple text column before, we can leave it or add a constraint)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'proposta_versoes' AND column_name = 'generation_status'
    ) THEN
        -- No-op, we just use it as a text column with canonical values in app logic
    END IF;
END $$;
