-- Add sync tracking fields to each bank
ALTER TABLE public.financiamento_bancos 
ADD COLUMN fonte_sync text DEFAULT 'manual',
ADD COLUMN ultima_sync timestamp with time zone,
ADD COLUMN api_customizada_url text,
ADD COLUMN codigo_bcb text;

-- Add comments for clarity
COMMENT ON COLUMN public.financiamento_bancos.fonte_sync IS 'Source of last sync: manual, bcb, api_customizada';
COMMENT ON COLUMN public.financiamento_bancos.codigo_bcb IS 'BCB institution code for automatic sync';