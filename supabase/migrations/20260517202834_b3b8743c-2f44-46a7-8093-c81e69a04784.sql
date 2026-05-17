-- Add marketing origin columns to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'organico',
ADD COLUMN IF NOT EXISTS campanha_nome TEXT,
ADD COLUMN IF NOT EXISTS campanha_id TEXT,
ADD COLUMN IF NOT EXISTS ad_nome TEXT;

-- Create index for faster filtering by origin/campaign
CREATE INDEX IF NOT EXISTS idx_leads_origem ON public.leads(origem);
CREATE INDEX IF NOT EXISTS idx_leads_campanha_id ON public.leads(campanha_id);
