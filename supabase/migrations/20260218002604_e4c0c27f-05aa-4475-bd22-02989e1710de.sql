-- 1. Add file_url column for DOCX templates
ALTER TABLE public.proposta_templates
ADD COLUMN file_url TEXT;

-- 2. Create storage bucket for template files
INSERT INTO storage.buckets (id, name, public)
VALUES ('proposta-templates', 'proposta-templates', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for the bucket
CREATE POLICY "Authenticated users can read template files"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposta-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload template files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proposta-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update template files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'proposta-templates' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete template files"
ON storage.objects FOR DELETE
USING (bucket_id = 'proposta-templates' AND auth.role() = 'authenticated');