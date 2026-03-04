
-- ══════════════════════════════════════════════════════════════
-- Extend contacts + create contact_identities + integration_events
-- ══════════════════════════════════════════════════════════════

-- 1) Add new columns to existing contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '["cliente"]'::jsonb,
  ADD COLUMN IF NOT EXISTS external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill display_name from name for existing rows
UPDATE public.contacts SET display_name = COALESCE(name, phone_e164) WHERE display_name IS NULL;

-- Backfill phones jsonb from phone_e164
UPDATE public.contacts
SET phones = jsonb_build_array(jsonb_build_object('value', phone_e164, 'e164', phone_e164, 'label', 'whatsapp', 'is_primary', true))
WHERE phone_e164 IS NOT NULL AND phones = '[]'::jsonb;

-- 2) contact_identities
CREATE TABLE public.contact_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  identity_type text NOT NULL CHECK (identity_type IN ('phone_e164', 'email', 'google_resource')),
  identity_value text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, identity_type, identity_value)
);

CREATE INDEX idx_contact_identities_contact ON public.contact_identities(contact_id);
CREATE INDEX idx_contact_identities_lookup ON public.contact_identities(tenant_id, identity_type, identity_value);

ALTER TABLE public.contact_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ci_select" ON public.contact_identities FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ci_insert" ON public.contact_identities FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ci_update" ON public.contact_identities FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ci_delete" ON public.contact_identities FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 3) integration_events
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  provider text NOT NULL DEFAULT 'google_contacts',
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  request jsonb,
  response jsonb,
  error_message text,
  items_processed int DEFAULT 0,
  items_created int DEFAULT 0,
  items_updated int DEFAULT 0,
  items_skipped int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_events_tenant ON public.integration_events(tenant_id, provider, created_at DESC);

ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ie_select" ON public.integration_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ie_insert" ON public.integration_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 4) updated_at trigger for contacts (if not exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Phone normalization helper
CREATE OR REPLACE FUNCTION public.normalize_phone_e164(raw text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := regexp_replace(raw, '[^0-9+]', '', 'g');
  IF cleaned LIKE '+%' THEN RETURN cleaned; END IF;
  IF length(cleaned) BETWEEN 10 AND 11 THEN RETURN '+55' || cleaned; END IF;
  IF length(cleaned) BETWEEN 12 AND 13 AND cleaned LIKE '55%' THEN RETURN '+' || cleaned; END IF;
  RETURN '+' || cleaned;
END;
$$;

-- 6) Backfill contact_identities from existing contacts
INSERT INTO public.contact_identities (tenant_id, contact_id, identity_type, identity_value, is_primary)
SELECT tenant_id, id, 'phone_e164', phone_e164, true
FROM public.contacts
WHERE phone_e164 IS NOT NULL
ON CONFLICT (tenant_id, identity_type, identity_value) DO NOTHING;
