
-- Add projeto_id column to deals to link projects to deals
ALTER TABLE public.deals
ADD COLUMN projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;

-- Index for fast lookup
CREATE INDEX idx_deals_projeto_id ON public.deals(projeto_id) WHERE projeto_id IS NOT NULL;
