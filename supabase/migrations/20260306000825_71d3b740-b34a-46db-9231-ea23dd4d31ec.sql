
-- 1) integrations_api_configs table
CREATE TABLE public.integrations_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'tuya',
  name text NOT NULL,
  status text NOT NULL DEFAULT 'inactive',
  region text,
  base_url text,
  credentials jsonb NOT NULL DEFAULT '{}',
  settings jsonb NOT NULL DEFAULT '{}',
  last_tested_at timestamptz,
  last_sync_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE(tenant_id, provider, name)
);

ALTER TABLE public.integrations_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.integrations_api_configs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE INDEX idx_integrations_api_configs_tenant ON public.integrations_api_configs(tenant_id);

-- 2) Secure view for billing settings (hides pdf_password)
CREATE OR REPLACE VIEW public.unit_billing_email_settings_safe
WITH (security_invoker = on) AS
  SELECT id, tenant_id, unit_id, billing_capture_email, forward_to_email,
         (pdf_password IS NOT NULL AND pdf_password <> '') AS has_pdf_password,
         email_billing_enabled, setup_status, notes, created_at, updated_at
  FROM public.unit_billing_email_settings;

-- 3) RPC for atomic meter linking (prevents duplicate active principal)
CREATE OR REPLACE FUNCTION public.link_meter_to_unit(
  p_unit_id uuid,
  p_meter_device_id uuid,
  p_link_type text DEFAULT 'principal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_link_id uuid;
  v_existing_count int;
BEGIN
  -- Resolve tenant
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  -- Verify unit belongs to tenant
  PERFORM 1 FROM units_consumidoras WHERE id = p_unit_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UC não encontrada'; END IF;

  -- Verify meter belongs to tenant
  PERFORM 1 FROM meter_devices WHERE id = p_meter_device_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medidor não encontrado'; END IF;

  -- Check for existing active principal link for this meter
  IF p_link_type = 'principal' THEN
    -- Deactivate existing principal links for this meter
    UPDATE unit_meter_links
    SET is_active = false, ended_at = now(), updated_at = now()
    WHERE meter_device_id = p_meter_device_id
      AND is_active = true
      AND link_type = 'principal'
      AND tenant_id = v_tenant_id;
  END IF;

  -- Create new link
  INSERT INTO unit_meter_links (tenant_id, unit_id, meter_device_id, link_type, started_at, is_active)
  VALUES (v_tenant_id, p_unit_id, p_meter_device_id, p_link_type, now(), true)
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$;

-- 4) RPC for secure pdf_password update (write-only)
CREATE OR REPLACE FUNCTION public.set_billing_pdf_password(
  p_unit_id uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'Tenant não identificado'; END IF;

  -- Verify unit belongs to tenant
  PERFORM 1 FROM units_consumidoras WHERE id = p_unit_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UC não encontrada'; END IF;

  -- Upsert
  INSERT INTO unit_billing_email_settings (tenant_id, unit_id, pdf_password)
  VALUES (v_tenant_id, p_unit_id, p_password)
  ON CONFLICT (unit_id) DO UPDATE SET pdf_password = p_password, updated_at = now();
END;
$$;
