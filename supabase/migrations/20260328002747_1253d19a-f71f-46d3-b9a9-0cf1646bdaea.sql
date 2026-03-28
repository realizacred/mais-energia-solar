
-- 1. Add Facebook attribution columns to leads
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS facebook_lead_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_id text,
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Unique index for dedup
CREATE UNIQUE INDEX IF NOT EXISTS leads_facebook_lead_id_idx
  ON leads(facebook_lead_id) WHERE facebook_lead_id IS NOT NULL;

-- 2. Add lead_id FK to facebook_leads
ALTER TABLE facebook_leads
  ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id);

-- 3. Create facebook_lead_automations table
CREATE TABLE IF NOT EXISTS facebook_lead_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES pipelines(id),
  stage_id uuid REFERENCES pipeline_stages(id),
  responsible_user_id uuid REFERENCES profiles(id),
  round_robin boolean DEFAULT false,
  round_robin_users uuid[] DEFAULT '{}',
  round_robin_index integer DEFAULT 0,
  active boolean DEFAULT true,
  field_mapping jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for facebook_lead_automations
ALTER TABLE facebook_lead_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for facebook_lead_automations"
  ON facebook_lead_automations
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
