
-- Add loss premises to solar_plants (used as plant config)
ALTER TABLE public.solar_plants
  ADD COLUMN IF NOT EXISTS shading_loss_percent numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS soiling_loss_percent numeric DEFAULT 3,
  ADD COLUMN IF NOT EXISTS other_losses_percent numeric DEFAULT 10;

COMMENT ON COLUMN public.solar_plants.shading_loss_percent IS 'Shading loss factor (default 5%)';
COMMENT ON COLUMN public.solar_plants.soiling_loss_percent IS 'Soiling/dirt loss factor (default 3%)';
COMMENT ON COLUMN public.solar_plants.other_losses_percent IS 'Other system losses: wiring, inverter efficiency, etc. (default 10%)';
