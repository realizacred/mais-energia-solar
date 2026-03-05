
-- Fix Security Definer Views by setting security_invoker = true
ALTER VIEW public.estoque_saldos SET (security_invoker = true);
ALTER VIEW public.estoque_saldos_local SET (security_invoker = true);

-- Fix trigger_set_updated_at search_path
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
