
-- Security events table (was in failed first migration)
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  ip_hash text,
  user_agent_hash text,
  path text,
  consultor_code_hash text,
  success boolean NOT NULL DEFAULT false,
  tenant_id uuid REFERENCES public.tenants(id),
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_events_super_admin_read"
  ON public.security_events FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "security_events_no_public_write"
  ON public.security_events FOR INSERT
  WITH CHECK (false);

CREATE INDEX idx_security_events_type_created 
  ON public.security_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_security_events()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM security_events WHERE created_at < now() - interval '90 days';
END;
$$;
