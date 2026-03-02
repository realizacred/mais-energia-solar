-- Add unit_price column to solar_kit_catalog_items so catalog kits can store pricing
ALTER TABLE public.solar_kit_catalog_items
ADD COLUMN unit_price numeric NOT NULL DEFAULT 0;