
-- ╔══════════════════════════════════════════════════════════════╗
-- ║  INTEGRATIONS MODULE — Schema v1                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1. ENUM: integration_provider
CREATE TYPE public.integration_provider AS ENUM ('google_calendar');

-- 2. ENUM: integration_status
CREATE TYPE public.integration_status AS ENUM (
  'disconnected', 'connected', 'error', 'revoked', 'expired'
);

-- 3. ENUM: integration_audit_action
CREATE TYPE public.integration_audit_action AS ENUM (
  'connect_started', 'connect_completed', 'callback_received',
  'test_success', 'test_fail',
  'disconnect', 'reauthorize',
  'token_refreshed', 'token_revoked', 'token_expired'
);

-- ═══════════════════════════════════════════════════════════
-- TABLE: integrations  (1 row per provider per tenant)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  connected_account_email text,
  default_calendar_id text,
  default_calendar_name text,
  scopes text[],
  last_test_at timestamptz,
  last_test_status text,
  last_error_code text,
  last_error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique: only one integration per provider per tenant
CREATE UNIQUE INDEX uq_integrations_tenant_provider 
  ON public.integrations (tenant_id, provider);

CREATE INDEX idx_integrations_tenant 
  ON public.integrations (tenant_id);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_tenant_select" ON public.integrations
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

CREATE POLICY "integrations_tenant_insert" ON public.integrations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

CREATE POLICY "integrations_tenant_update" ON public.integrations
  FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

CREATE POLICY "integrations_tenant_delete" ON public.integrations
  FOR DELETE TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════
-- TABLE: integration_credentials  (tokens, separated)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  token_type text DEFAULT 'Bearer',
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX idx_intcred_integration 
  ON public.integration_credentials (integration_id);

ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Credentials: ONLY service_role can read/write (no direct client access)
-- Authenticated users should never see tokens directly
CREATE POLICY "intcred_service_role_all" ON public.integration_credentials
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- TABLE: integration_audit_events  (append-only audit log)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.integration_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  actor_id uuid,
  action public.integration_audit_action NOT NULL,
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'fail')),
  ip text,
  user_agent text,
  metadata_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intaudit_tenant 
  ON public.integration_audit_events (tenant_id);
CREATE INDEX idx_intaudit_integration 
  ON public.integration_audit_events (integration_id);
CREATE INDEX idx_intaudit_created 
  ON public.integration_audit_events (created_at DESC);

ALTER TABLE public.integration_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intaudit_tenant_select" ON public.integration_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

-- Insert: both authenticated (from edge functions forwarding) and service_role
CREATE POLICY "intaudit_tenant_insert" ON public.integration_audit_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

CREATE POLICY "intaudit_service_insert" ON public.integration_audit_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- TABLE: integration_webhook_endpoints  (future use)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.integration_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  endpoint_url text NOT NULL,
  webhook_secret text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intwh_tenant_select" ON public.integration_webhook_endpoints
  FOR SELECT TO authenticated
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════
-- TRIGGER: updated_at auto-update
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_integration_webhook_updated_at
  BEFORE UPDATE ON public.integration_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- Cleanup old google-calendar tables/columns if they exist
-- ═══════════════════════════════════════════════════════════
-- (these were removed in a previous migration, safe to skip if already gone)
