
-- Custom fields definition table for deals
CREATE TABLE public.deal_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean', 'currency', 'textarea')),
  field_context TEXT NOT NULL DEFAULT 'projeto' CHECK (field_context IN ('projeto', 'pre_dimensionamento', 'pos_dimensionamento')),
  options JSONB DEFAULT NULL, -- For select type fields
  ordem INTEGER DEFAULT 0,
  show_on_create BOOLEAN DEFAULT false,
  required_on_create BOOLEAN DEFAULT false,
  visible_on_funnel BOOLEAN DEFAULT false,
  important_on_funnel BOOLEAN DEFAULT false,
  required_on_funnel BOOLEAN DEFAULT false,
  required_on_proposal BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, field_key)
);

ALTER TABLE public.deal_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view custom fields"
  ON public.deal_custom_fields FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Admins can manage custom fields"
  ON public.deal_custom_fields FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Custom field values per deal
CREATE TABLE public.deal_custom_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES deal_custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_date DATE,
  value_boolean BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, field_id)
);

ALTER TABLE public.deal_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view custom field values"
  ON public.deal_custom_field_values FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Tenant members can manage custom field values"
  ON public.deal_custom_field_values FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- Activity types configuration table (customizable per tenant)
CREATE TABLE public.deal_activity_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  visible_on_funnel BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view activity types"
  ON public.deal_activity_types FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Admins can manage activity types"
  ON public.deal_activity_types FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));

-- RLS for motivos_perda (ensure it exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'motivos_perda' AND policyname = 'Tenant members can view motivos_perda') THEN
    CREATE POLICY "Tenant members can view motivos_perda"
      ON public.motivos_perda FOR SELECT
      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'motivos_perda' AND policyname = 'Admins can manage motivos_perda') THEN
    CREATE POLICY "Admins can manage motivos_perda"
      ON public.motivos_perda FOR ALL
      USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
