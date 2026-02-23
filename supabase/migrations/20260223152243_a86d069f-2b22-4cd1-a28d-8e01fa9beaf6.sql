
-- Soft delete columns for leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- Index for fast filtering of active leads
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads (deleted_at) WHERE deleted_at IS NULL;

-- Comment for documentation
COMMENT ON COLUMN public.leads.deleted_at IS 'Soft delete timestamp. NULL = active lead.';
COMMENT ON COLUMN public.leads.deleted_by IS 'User who soft-deleted this lead.';
