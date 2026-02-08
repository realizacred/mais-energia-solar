-- Corrigir cores da identidade visual: Primária = Laranja, Secundária = Azul Corporativo
UPDATE brand_settings
SET
  color_primary = '25 100% 50%',
  color_primary_foreground = '0 0% 100%',
  color_secondary = '210 100% 40%',
  color_secondary_foreground = '0 0% 100%',
  dark_color_primary = '25 100% 55%',
  updated_at = now()
WHERE id = (SELECT id FROM brand_settings LIMIT 1);
