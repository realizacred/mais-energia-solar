-- Fix: Set default tenant_id on deals table using require_tenant_id()
ALTER TABLE public.deals
  ALTER COLUMN tenant_id SET DEFAULT (public.require_tenant_id());
