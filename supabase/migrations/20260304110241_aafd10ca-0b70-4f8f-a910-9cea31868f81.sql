-- Create unique constraint for upsert on facebook_ad_metrics
-- Using a unique index since the columns may have nulls
CREATE UNIQUE INDEX IF NOT EXISTS facebook_ad_metrics_tenant_date_campaign_ad_idx
  ON public.facebook_ad_metrics (tenant_id, date, COALESCE(campaign_id, ''), COALESCE(ad_id, ''));