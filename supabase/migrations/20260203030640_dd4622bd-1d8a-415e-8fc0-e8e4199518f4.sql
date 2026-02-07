-- Create storage bucket for electricity bills
INSERT INTO storage.buckets (id, name, public)
VALUES ('contas-luz', 'contas-luz', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contas-luz');

-- Allow authenticated users to view all files
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
USING (bucket_id = 'contas-luz');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
USING (bucket_id = 'contas-luz');

-- Allow anonymous uploads (for the public form)
CREATE POLICY "Anyone can upload to contas-luz"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contas-luz');

-- Add column to store file URLs in leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS arquivos_urls text[] DEFAULT '{}';