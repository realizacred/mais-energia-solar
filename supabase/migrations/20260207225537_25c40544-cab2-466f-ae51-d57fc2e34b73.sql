-- Create a public bucket for brand assets (logos, favicons, login images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload brand assets
CREATE POLICY "Admins can upload brand assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'brand-assets'
  AND public.is_admin(auth.uid())
);

-- Allow admins to update brand assets
CREATE POLICY "Admins can update brand assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'brand-assets'
  AND public.is_admin(auth.uid())
);

-- Allow admins to delete brand assets
CREATE POLICY "Admins can delete brand assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'brand-assets'
  AND public.is_admin(auth.uid())
);

-- Allow public read access to brand assets (logos need to be visible to everyone)
CREATE POLICY "Public read brand assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');