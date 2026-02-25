
-- ============================================================
-- META FACEBOOK ADS INTEGRATION — Migration
-- ============================================================

-- 1) Expand integration_provider enum
ALTER TYPE public.integration_provider ADD VALUE IF NOT EXISTS 'meta_facebook';

-- 2) Create facebook_leads table
CREATE TABLE IF NOT EXISTS public.facebook_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  facebook_lead_id TEXT NOT NULL,
  form_id TEXT,
  page_id TEXT,
  campaign_id TEXT,
  adset_id TEXT,
  ad_id TEXT,
  lead_name TEXT,
  lead_email TEXT,
  lead_phone TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  processing_status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_facebook_lead_id UNIQUE (facebook_lead_id)
);

-- Indexes for facebook_leads
CREATE INDEX IF NOT EXISTS idx_facebook_leads_tenant_id ON public.facebook_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facebook_leads_tenant_status ON public.facebook_leads(tenant_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_facebook_leads_received_at ON public.facebook_leads(tenant_id, received_at DESC);

-- 3) Create facebook_ad_metrics table
CREATE TABLE IF NOT EXISTS public.facebook_ad_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  date DATE NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  leads_count BIGINT NOT NULL DEFAULT 0,
  ctr NUMERIC(8,4) NOT NULL DEFAULT 0,
  cpc NUMERIC(12,4) NOT NULL DEFAULT 0,
  cpl NUMERIC(12,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fb_metric_tenant_date_campaign UNIQUE (tenant_id, date, campaign_id)
);

-- Indexes for facebook_ad_metrics
CREATE INDEX IF NOT EXISTS idx_fb_metrics_tenant_id ON public.facebook_ad_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fb_metrics_tenant_date ON public.facebook_ad_metrics(tenant_id, date DESC);

-- 4) Enable RLS
ALTER TABLE public.facebook_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_ad_metrics ENABLE ROW LEVEL SECURITY;

-- 5) RLS policies for facebook_leads
CREATE POLICY "tenant_select_facebook_leads" ON public.facebook_leads
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_insert_facebook_leads" ON public.facebook_leads
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_update_facebook_leads" ON public.facebook_leads
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_delete_facebook_leads" ON public.facebook_leads
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());

-- 6) RLS policies for facebook_ad_metrics
CREATE POLICY "tenant_select_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_insert_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_update_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_delete_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR DELETE USING (tenant_id = public.get_user_tenant_id());

-- 7) Service-role policies for webhook Edge Function (bypasses user context)
CREATE POLICY "service_insert_facebook_leads" ON public.facebook_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_select_facebook_leads" ON public.facebook_leads
  FOR SELECT USING (true);

-- Service role for metrics sync
CREATE POLICY "service_insert_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "service_update_facebook_ad_metrics" ON public.facebook_ad_metrics
  FOR UPDATE USING (true) WITH CHECK (true);

-- 8) updated_at triggers (reuse existing function)
CREATE TRIGGER update_facebook_leads_updated_at
  BEFORE UPDATE ON public.facebook_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_facebook_ad_metrics_updated_at
  BEFORE UPDATE ON public.facebook_ad_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
