
-- FASE 5: SECURITY HARDENING — search_path + RLS

-- SECURITY DEFINER (CRITICAL)
ALTER FUNCTION public.audit_row_change() SET search_path = public;
ALTER FUNCTION public.get_smtp_password(text) SET search_path = public;

-- SECURITY INVOKER
ALTER FUNCTION public.canonicalize_phone_br(text) SET search_path = public;
ALTER FUNCTION public.current_tenant_id() SET search_path = public;
ALTER FUNCTION public.decrypt_secret(bytea, text) SET search_path = public;
ALTER FUNCTION public.encrypt_secret(text, text) SET search_path = public;
ALTER FUNCTION public.get_or_create_cliente(text, text, text, text, text, text, text, text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.normalize_phone(text) SET search_path = public;
ALTER FUNCTION public.prevent_empty_active_version() SET search_path = public;
ALTER FUNCTION public.release_outbox_lock() SET search_path = public;
ALTER FUNCTION public.release_outbox_lock(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.trg_normalize_wa_phone() SET search_path = public;
ALTER FUNCTION public.try_outbox_lock() SET search_path = public;
ALTER FUNCTION public.try_outbox_lock(uuid, uuid) SET search_path = public;

-- Harden RLS: proposta_aceite_tokens UPDATE
DROP POLICY IF EXISTS "Anyone can update tokens for acceptance" ON public.proposta_aceite_tokens;
CREATE POLICY "Anyone can update tokens for acceptance"
  ON public.proposta_aceite_tokens
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (expires_at > now());

-- Harden RLS: wa_health_checks INSERT (restrict to service_role)
DROP POLICY IF EXISTS "Service role can insert health checks" ON public.wa_health_checks;
CREATE POLICY "Service role can insert health checks"
  ON public.wa_health_checks
  FOR INSERT TO service_role
  WITH CHECK (true);
