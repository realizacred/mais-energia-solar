
-- Create the update_updated_at function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create brand_settings table for dynamic visual identity
CREATE TABLE public.brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Colors (HSL strings like "25 100% 50%")
  color_primary text NOT NULL DEFAULT '25 100% 50%',
  color_primary_foreground text NOT NULL DEFAULT '0 0% 100%',
  color_secondary text NOT NULL DEFAULT '210 100% 40%',
  color_secondary_foreground text NOT NULL DEFAULT '0 0% 100%',
  color_accent text NOT NULL DEFAULT '220 14% 93%',
  color_accent_foreground text NOT NULL DEFAULT '222 47% 11%',
  color_background text NOT NULL DEFAULT '0 0% 99%',
  color_foreground text NOT NULL DEFAULT '222 47% 11%',
  color_card text NOT NULL DEFAULT '0 0% 100%',
  color_card_foreground text NOT NULL DEFAULT '222 47% 11%',
  color_border text NOT NULL DEFAULT '220 13% 91%',
  color_destructive text NOT NULL DEFAULT '0 72% 51%',
  color_success text NOT NULL DEFAULT '142 71% 45%',
  color_warning text NOT NULL DEFAULT '38 92% 50%',
  color_info text NOT NULL DEFAULT '199 89% 48%',
  color_muted text NOT NULL DEFAULT '220 14% 96%',
  color_muted_foreground text NOT NULL DEFAULT '220 9% 46%',
  
  -- Dark mode overrides
  dark_color_primary text NOT NULL DEFAULT '25 100% 55%',
  dark_color_background text NOT NULL DEFAULT '222 47% 6%',
  dark_color_foreground text NOT NULL DEFAULT '210 40% 98%',
  dark_color_card text NOT NULL DEFAULT '222 47% 8%',
  dark_color_border text NOT NULL DEFAULT '217 33% 18%',
  dark_color_muted text NOT NULL DEFAULT '217 33% 15%',
  dark_color_muted_foreground text NOT NULL DEFAULT '215 20% 65%',
  
  -- Fonts
  font_heading text NOT NULL DEFAULT 'Plus Jakarta Sans',
  font_body text NOT NULL DEFAULT 'Inter',
  font_size_base text NOT NULL DEFAULT '16px',
  font_weight_heading text NOT NULL DEFAULT '700',
  
  -- Logos (URLs from storage)
  logo_url text NULL,
  logo_small_url text NULL,
  favicon_url text NULL,
  login_image_url text NULL,
  
  -- Theme
  default_theme text NOT NULL DEFAULT 'light',
  allow_theme_switch boolean NOT NULL DEFAULT true,
  
  -- Border radius
  border_radius text NOT NULL DEFAULT '0.625rem',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins manage brand_settings"
  ON public.brand_settings FOR ALL
  USING (is_admin(auth.uid()));

-- Anyone can read (needed to apply theme globally)
CREATE POLICY "Public read brand_settings"
  ON public.brand_settings FOR SELECT
  USING (true);

-- Insert default row
INSERT INTO public.brand_settings (id) VALUES (gen_random_uuid());

-- Updated_at trigger
CREATE TRIGGER update_brand_settings_updated_at
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
