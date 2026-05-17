CREATE TABLE IF NOT EXISTS public.facebook_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE,
  access_token TEXT,
  token_type TEXT DEFAULT 'long_lived',
  expires_at TIMESTAMPTZ,
  ad_account_ids TEXT[],  -- selected ad accounts
  page_ids TEXT[],        -- selected pages
  status TEXT DEFAULT 'connected',
  connected_at TIMESTAMPTZ DEFAULT now(),
  connected_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facebook_integrations ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming there's a way to determine tenant_id from auth.uid or similar)
-- For now, let's use a simple tenant_id check if the user has access to that tenant.
-- Often in these systems, there is a profiles table with a tenant_id.

CREATE POLICY "Users can view their own tenant facebook integrations"
ON public.facebook_integrations
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own tenant facebook integrations"
ON public.facebook_integrations
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own tenant facebook integrations"
ON public.facebook_integrations
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own tenant facebook integrations"
ON public.facebook_integrations
FOR DELETE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_facebook_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_facebook_integrations_updated_at
BEFORE UPDATE ON public.facebook_integrations
FOR EACH ROW
EXECUTE FUNCTION update_facebook_integrations_updated_at();
