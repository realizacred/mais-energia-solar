
-- 1) Ensure current_tenant_id() exists (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2) Add storage_path column to post_sale_attachments
ALTER TABLE public.post_sale_attachments
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Make storage_path NOT NULL with a default for existing rows
UPDATE public.post_sale_attachments
SET storage_path = COALESCE(file_url, 'legacy/' || id)
WHERE storage_path IS NULL;

ALTER TABLE public.post_sale_attachments
  ALTER COLUMN storage_path SET NOT NULL;

-- 3) Fix storage bucket: ensure it exists and is PRIVATE
UPDATE storage.buckets SET public = false WHERE id = 'post_sale_attachments';

-- 4) Drop existing storage policies for this bucket and recreate
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname ILIKE '%post_sale_attach%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 5) Create tenant-safe storage policies
CREATE POLICY "ps_attach_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "ps_attach_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);

CREATE POLICY "ps_attach_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_tenant_id()::text
);
