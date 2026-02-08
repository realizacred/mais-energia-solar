UPDATE public.brand_settings
SET
  -- Cores Principais (vibrantes, fiéis à logo)
  color_primary = '28 95% 53%',
  color_primary_foreground = '0 0% 100%',
  color_secondary = '225 78% 30%',
  color_secondary_foreground = '0 0% 100%',
  color_accent = '28 20% 93%',
  color_accent_foreground = '225 40% 15%',
  -- Interface
  color_background = '225 14% 96%',
  color_foreground = '225 25% 12%',
  color_card = '0 0% 100%',
  color_card_foreground = '225 25% 12%',
  color_border = '225 12% 90%',
  color_muted = '225 12% 94%',
  color_muted_foreground = '225 10% 46%',
  -- Status
  color_destructive = '4 48% 44%',
  color_success = '158 42% 38%',
  color_warning = '38 52% 48%',
  color_info = '210 46% 48%',
  -- Dark mode
  dark_color_primary = '28 90% 55%',
  dark_color_background = '225 28% 7%',
  dark_color_foreground = '225 12% 92%',
  dark_color_card = '225 24% 9%',
  dark_color_border = '225 18% 15%',
  dark_color_muted = '225 20% 14%',
  dark_color_muted_foreground = '225 10% 58%',
  updated_at = now()
WHERE id = 'b345269e-0049-42dd-b8ab-effee86a7870';
