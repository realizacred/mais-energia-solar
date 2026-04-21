ALTER TABLE public.solarmarket_promotion_jobs
  ADD COLUMN IF NOT EXISTS items_blocked integer NOT NULL DEFAULT 0;