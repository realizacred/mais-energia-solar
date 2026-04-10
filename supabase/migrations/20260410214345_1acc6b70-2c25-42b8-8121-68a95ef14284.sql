-- Emergency: block all migrations immediately
UPDATE public.solar_market_config SET migration_blocked = true;

-- Also set the column default to true so any new config rows also block by default
ALTER TABLE public.solar_market_config ALTER COLUMN migration_blocked SET DEFAULT true;