ALTER TABLE public.tenant_premises
  ADD COLUMN IF NOT EXISTS shading_loss_percent numeric DEFAULT 8,
  ADD COLUMN IF NOT EXISTS soiling_loss_percent numeric DEFAULT 5,
  ADD COLUMN IF NOT EXISTS other_losses_percent numeric DEFAULT 12;

COMMENT ON COLUMN public.tenant_premises.shading_loss_percent IS 'Default shading loss % for monitoring expected yield';
COMMENT ON COLUMN public.tenant_premises.soiling_loss_percent IS 'Default soiling loss % for monitoring expected yield';
COMMENT ON COLUMN public.tenant_premises.other_losses_percent IS 'Default other losses % (clipping, wiring, etc.) for monitoring expected yield';