
-- Add artifact persistence columns to proposta_versoes
ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS output_docx_path text,
  ADD COLUMN IF NOT EXISTS output_pdf_path text,
  ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generation_error text,
  ADD COLUMN IF NOT EXISTS template_id_used uuid REFERENCES public.proposta_templates(id),
  ADD COLUMN IF NOT EXISTS generated_at timestamptz;

-- Add comment for clarity
COMMENT ON COLUMN public.proposta_versoes.output_docx_path IS 'Storage path of the generated DOCX file';
COMMENT ON COLUMN public.proposta_versoes.output_pdf_path IS 'Storage path of the generated PDF file';
COMMENT ON COLUMN public.proposta_versoes.generation_status IS 'pending | generating | converting | ready | error';
COMMENT ON COLUMN public.proposta_versoes.generation_error IS 'Error message if generation failed';
COMMENT ON COLUMN public.proposta_versoes.template_id_used IS 'Template used for this specific version generation';
COMMENT ON COLUMN public.proposta_versoes.generated_at IS 'Timestamp when the document was last generated';

-- Create bucket for generated proposal documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposta-documentos', 'proposta-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for proposta-documentos bucket
CREATE POLICY "Auth users can read own tenant docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proposta-documentos'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

CREATE POLICY "Auth users can insert own tenant docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proposta-documentos'
  AND (storage.foldername(name))[1] = (public.current_tenant_id())::text
);

CREATE POLICY "Service role full access proposta-documentos"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'proposta-documentos');
