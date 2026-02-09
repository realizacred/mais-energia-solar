-- Add last tariff sync timestamp to concessionarias
ALTER TABLE public.concessionarias 
ADD COLUMN IF NOT EXISTS ultima_sync_tarifas TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.concessionarias.ultima_sync_tarifas IS 'Timestamp da última sincronização de tarifas com a API da ANEEL';