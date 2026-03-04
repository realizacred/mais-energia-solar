ALTER TABLE public.facebook_ad_metrics 
  ADD COLUMN IF NOT EXISTS reach bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effective_status text DEFAULT null;