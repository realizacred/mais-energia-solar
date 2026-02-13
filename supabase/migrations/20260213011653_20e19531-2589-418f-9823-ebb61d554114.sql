-- Add custom_loader_url column for uploaded custom loader images
ALTER TABLE public.loading_config
ADD COLUMN custom_loader_url text DEFAULT NULL;