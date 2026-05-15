-- Add missing columns to credit_bank_configs
ALTER TABLE public.credit_bank_configs 
ADD COLUMN IF NOT EXISTS prazo_medio TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Add missing columns to credit_bank_checklists
ALTER TABLE public.credit_bank_checklists 
ADD COLUMN IF NOT EXISTS applicable_to TEXT DEFAULT 'both' CHECK (applicable_to IN ('pf', 'pj', 'both')),
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update existing data for better defaults
UPDATE public.credit_bank_checklists SET applicable_to = 'both' WHERE applicable_to IS NULL;
UPDATE public.credit_bank_checklists SET sort_order = 0 WHERE sort_order IS NULL;