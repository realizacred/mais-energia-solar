-- Add loader_theme column to support multiple visual themes
ALTER TABLE public.loading_config
ADD COLUMN loader_theme text NOT NULL DEFAULT 'sun';

COMMENT ON COLUMN public.loading_config.loader_theme IS 'Visual theme: sun, lightning, leaf, gear, dots, ring';