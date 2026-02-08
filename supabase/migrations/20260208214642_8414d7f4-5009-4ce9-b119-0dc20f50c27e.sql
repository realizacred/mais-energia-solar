
-- Add api_token and auth_mode columns to solar_market_config
ALTER TABLE public.solar_market_config
  ADD COLUMN IF NOT EXISTS api_token TEXT,
  ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'token';

-- Add comment for clarity
COMMENT ON COLUMN public.solar_market_config.api_token IS 'Direct API token for Bearer authentication';
COMMENT ON COLUMN public.solar_market_config.auth_mode IS 'Authentication mode: token (direct Bearer) or credentials (email/password)';
