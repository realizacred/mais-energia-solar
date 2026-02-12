
-- Add column defaults for tenant_id on tables that use triggers to resolve it
-- This ensures the Supabase types generator marks tenant_id as optional in Insert types
-- The triggers (resolve_lead_tenant_id, resolve_orc_tenant_id) will override the value

-- For leads: uses resolve_lead_tenant_id trigger
ALTER TABLE public.leads ALTER COLUMN tenant_id SET DEFAULT (get_user_tenant_id());

-- For orcamentos: uses resolve_orc_tenant_id trigger  
ALTER TABLE public.orcamentos ALTER COLUMN tenant_id SET DEFAULT (get_user_tenant_id());

-- For clientes: already has require_tenant_id() default — good

-- For wa_conversations: uses get_user_tenant_id() default — verify
-- Already has default, confirmed from initial query

-- For profiles: already has get_user_tenant_id() default — good

-- For vendedores: already has require_tenant_id() default — good

-- For propostas: already has require_tenant_id() default — good
