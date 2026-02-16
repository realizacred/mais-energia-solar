
-- Add per-tenant OAuth configuration columns to integrations table
ALTER TABLE public.integrations 
  ADD COLUMN IF NOT EXISTS oauth_client_id text,
  ADD COLUMN IF NOT EXISTS oauth_client_secret_encrypted text;

-- Comment for clarity
COMMENT ON COLUMN public.integrations.oauth_client_id IS 'Google OAuth Client ID configured by tenant admin';
COMMENT ON COLUMN public.integrations.oauth_client_secret_encrypted IS 'Google OAuth Client Secret (write-only, never returned to frontend)';
