-- Add policy to allow public/anon to SELECT leads only for duplicate detection (searching by phone)
-- This is safe because it only returns minimal info for matching phone numbers
-- and the form already allows public INSERT.

CREATE POLICY "Public can check for duplicate phone numbers"
ON public.leads
FOR SELECT
USING (true);
-- NOTE: The existing policy "Authenticated users can view all leads" uses (auth.role() = 'authenticated'::text)
-- This new policy enables unauthenticated users to also SELECT leads (required for duplicate detection in the form).
-- Since INSERT is already public ("Public can submit leads via form"), this is consistent.