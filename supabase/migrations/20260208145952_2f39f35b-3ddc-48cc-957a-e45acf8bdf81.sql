-- Add white logo URL field to brand_settings
ALTER TABLE public.brand_settings
ADD COLUMN IF NOT EXISTS logo_white_url TEXT DEFAULT NULL;