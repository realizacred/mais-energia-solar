
-- Add onboarding tracking to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;

-- Set existing tenants as already onboarded
UPDATE public.tenants SET onboarding_completed = true WHERE created_at < NOW() - INTERVAL '1 day';
