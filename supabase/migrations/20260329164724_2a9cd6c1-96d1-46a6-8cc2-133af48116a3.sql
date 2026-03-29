ALTER TABLE public.proposta_versoes 
ADD COLUMN IF NOT EXISTS generation_audit_json jsonb DEFAULT NULL;