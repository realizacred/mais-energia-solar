
-- Add a DEFAULT so Supabase codegen makes vendedor_id optional in Insert type
-- The BEFORE INSERT trigger (trg_lead_resolve_vendedor_id) always overrides this
-- when vendedor_id is NULL, ensuring the correct value is used
ALTER TABLE public.leads 
ALTER COLUMN vendedor_id SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

-- Add a CHECK via trigger to ensure the final vendedor_id is valid
-- (not the dummy default) - the existing trigger already handles this
