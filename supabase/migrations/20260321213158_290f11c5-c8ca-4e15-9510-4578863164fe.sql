ALTER TABLE public.gd_monthly_allocations
  ADD COLUMN IF NOT EXISTS prior_balance_kwh numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS used_from_balance_kwh numeric(12,2) NOT NULL DEFAULT 0;