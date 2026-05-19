ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

-- Index para performance em filtragens de orçamentos ativos
CREATE INDEX IF NOT EXISTS idx_orcamentos_deleted_at ON public.orcamentos(deleted_at) WHERE deleted_at IS NULL;