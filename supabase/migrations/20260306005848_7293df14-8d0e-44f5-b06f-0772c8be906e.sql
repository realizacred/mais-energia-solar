ALTER TABLE public.integrations_api_configs 
  ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();