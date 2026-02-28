
-- Add metadata jsonb to propostas_nativas for custom field mapped/unmapped storage
ALTER TABLE public.propostas_nativas
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.propostas_nativas.metadata IS 'Stores custom_fields_mapped, custom_fields_unmapped, and other extensible metadata';
