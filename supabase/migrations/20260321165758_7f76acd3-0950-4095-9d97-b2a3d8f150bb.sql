-- Add is_popular column to plans table
ALTER TABLE public.plans ADD COLUMN is_popular boolean NOT NULL DEFAULT false;

-- Set PRO as the popular/recommended plan
UPDATE public.plans SET is_popular = true WHERE code = 'pro';