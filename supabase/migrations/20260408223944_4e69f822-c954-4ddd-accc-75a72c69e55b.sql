
ALTER TABLE public.pipeline_automations
  ALTER COLUMN tenant_id SET DEFAULT (auth.jwt() ->> 'tenant_id')::uuid;
