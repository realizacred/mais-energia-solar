
-- Table to store SolarMarket funnels
CREATE TABLE public.solar_market_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sm_funnel_id INTEGER NOT NULL,
  name TEXT,
  stages JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_funnel_id)
);

-- Individual stages for easy querying
CREATE TABLE public.solar_market_funnel_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  sm_funnel_id INTEGER NOT NULL,
  sm_stage_id INTEGER NOT NULL,
  funnel_name TEXT,
  stage_name TEXT,
  stage_order INTEGER,
  raw_payload JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_funnel_id, sm_stage_id)
);

-- Add funnel/stage reference to projects table
ALTER TABLE public.solar_market_projects 
  ADD COLUMN IF NOT EXISTS sm_funnel_id INTEGER,
  ADD COLUMN IF NOT EXISTS sm_stage_id INTEGER,
  ADD COLUMN IF NOT EXISTS sm_funnel_name TEXT,
  ADD COLUMN IF NOT EXISTS sm_stage_name TEXT;

-- Enable RLS
ALTER TABLE public.solar_market_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solar_market_funnel_stages ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant isolation" ON public.solar_market_funnels
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON public.solar_market_funnel_stages
  FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_sm_funnels_tenant ON public.solar_market_funnels(tenant_id);
CREATE INDEX idx_sm_funnel_stages_tenant ON public.solar_market_funnel_stages(tenant_id);
CREATE INDEX idx_sm_projects_funnel ON public.solar_market_projects(sm_funnel_id);
