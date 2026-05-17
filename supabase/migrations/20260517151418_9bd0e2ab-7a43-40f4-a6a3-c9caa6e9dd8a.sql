-- Add portal_token and portal_ativo columns to projects
ALTER TABLE public.deals 
ADD COLUMN IF NOT EXISTS portal_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS portal_ativo BOOLEAN DEFAULT true;

-- Ensure all existing rows have a portal_token
UPDATE public.deals 
SET portal_token = gen_random_uuid() 
WHERE portal_token IS NULL;

-- Create an index for performance when searching by token
CREATE INDEX IF NOT EXISTS idx_deals_portal_token ON public.deals(portal_token);