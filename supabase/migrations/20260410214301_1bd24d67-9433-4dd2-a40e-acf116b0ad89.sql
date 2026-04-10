ALTER TABLE public.solar_market_config
ADD COLUMN IF NOT EXISTS migration_blocked boolean NOT NULL DEFAULT false;