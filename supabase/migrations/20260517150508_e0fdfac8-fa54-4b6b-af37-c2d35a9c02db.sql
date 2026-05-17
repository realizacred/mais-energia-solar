ALTER TABLE public.document_templates ADD COLUMN IF NOT EXISTS arquivo_base_path TEXT;

-- Create storage bucket for generated documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-documents', 'generated-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for generated-documents
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'generated-documents');
CREATE POLICY "Auth Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-documents' AND auth.role() = 'authenticated');
