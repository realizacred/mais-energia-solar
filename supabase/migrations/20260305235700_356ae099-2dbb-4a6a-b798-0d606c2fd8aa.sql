
-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE public.uc_type AS ENUM ('consumo', 'gd_geradora', 'beneficiaria');
CREATE TYPE public.meter_link_type AS ENUM ('principal', 'auxiliar', 'backup');
CREATE TYPE public.plant_relation_type AS ENUM ('geradora', 'beneficiaria', 'compensacao');
CREATE TYPE public.invoice_source AS ENUM ('email', 'manual', 'import', 'api');
CREATE TYPE public.billing_setup_status AS ENUM ('pending', 'active', 'error', 'disabled');

-- ============================================================
-- 1. units_consumidoras
-- ============================================================
CREATE TABLE public.units_consumidoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  codigo_uc text NOT NULL,
  nome text NOT NULL,
  tipo_uc public.uc_type NOT NULL DEFAULT 'consumo',
  concessionaria_id uuid REFERENCES public.concessionarias(id) ON DELETE SET NULL,
  concessionaria_nome text,
  classificacao_grupo text,
  classificacao_subgrupo text,
  modalidade_tarifaria text,
  endereco jsonb NOT NULL DEFAULT '{}',
  observacoes text,
  status text NOT NULL DEFAULT 'active',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (tenant_id, codigo_uc)
);

CREATE INDEX idx_units_consumidoras_tenant ON public.units_consumidoras(tenant_id);
CREATE INDEX idx_units_consumidoras_tipo ON public.units_consumidoras(tenant_id, tipo_uc);
CREATE INDEX idx_units_consumidoras_concessionaria ON public.units_consumidoras(tenant_id, concessionaria_id);

ALTER TABLE public.units_consumidoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uc_tenant_select" ON public.units_consumidoras FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "uc_tenant_insert" ON public.units_consumidoras FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "uc_tenant_update" ON public.units_consumidoras FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "uc_tenant_delete" ON public.units_consumidoras FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- 2. meter_devices
-- ============================================================
CREATE TABLE public.meter_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'tuya',
  integration_config_id uuid,
  external_device_id text NOT NULL,
  product_id text,
  model text,
  manufacturer text,
  serial_number text,
  name text NOT NULL,
  description text,
  category text,
  firmware_version text,
  online_status text DEFAULT 'unknown',
  health_status text DEFAULT 'unknown',
  bidirectional_supported boolean NOT NULL DEFAULT false,
  supports_import_energy boolean NOT NULL DEFAULT false,
  supports_export_energy boolean NOT NULL DEFAULT false,
  supports_power boolean NOT NULL DEFAULT true,
  installed_at timestamptz,
  last_seen_at timestamptz,
  last_reading_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  raw_device jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (tenant_id, provider, external_device_id)
);

CREATE INDEX idx_meter_devices_tenant ON public.meter_devices(tenant_id);
CREATE INDEX idx_meter_devices_provider ON public.meter_devices(tenant_id, provider);
CREATE INDEX idx_meter_devices_status ON public.meter_devices(tenant_id, online_status);

ALTER TABLE public.meter_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meter_tenant_select" ON public.meter_devices FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "meter_tenant_insert" ON public.meter_devices FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "meter_tenant_update" ON public.meter_devices FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "meter_tenant_delete" ON public.meter_devices FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- 3. meter_readings
-- ============================================================
CREATE TABLE public.meter_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  meter_device_id uuid NOT NULL REFERENCES public.meter_devices(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  voltage_v numeric,
  current_a numeric,
  power_w numeric,
  power_factor numeric,
  frequency_hz numeric,
  energy_import_kwh numeric,
  energy_export_kwh numeric,
  net_energy_kwh numeric,
  raw_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meter_readings_lookup ON public.meter_readings(tenant_id, meter_device_id, measured_at DESC);
CREATE INDEX idx_meter_readings_time ON public.meter_readings(tenant_id, measured_at DESC);

ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "readings_tenant_select" ON public.meter_readings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "readings_tenant_insert" ON public.meter_readings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- 4. meter_status_latest
-- ============================================================
CREATE TABLE public.meter_status_latest (
  meter_device_id uuid PRIMARY KEY REFERENCES public.meter_devices(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL,
  online_status text,
  voltage_v numeric,
  current_a numeric,
  power_w numeric,
  energy_import_kwh numeric,
  energy_export_kwh numeric,
  raw_payload jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meter_status_latest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_tenant_select" ON public.meter_status_latest FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "status_tenant_upsert" ON public.meter_status_latest FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "status_tenant_update" ON public.meter_status_latest FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- 5. unit_meter_links
-- ============================================================
CREATE TABLE public.unit_meter_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  meter_device_id uuid NOT NULL REFERENCES public.meter_devices(id) ON DELETE CASCADE,
  link_type public.meter_link_type NOT NULL DEFAULT 'principal',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX idx_unit_meter_links_unit ON public.unit_meter_links(tenant_id, unit_id, is_active);
CREATE INDEX idx_unit_meter_links_meter ON public.unit_meter_links(tenant_id, meter_device_id, is_active);

ALTER TABLE public.unit_meter_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uml_tenant_select" ON public.unit_meter_links FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "uml_tenant_insert" ON public.unit_meter_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "uml_tenant_update" ON public.unit_meter_links FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "uml_tenant_delete" ON public.unit_meter_links FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- 6. unit_plant_links
-- ============================================================
CREATE TABLE public.unit_plant_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  plant_id uuid NOT NULL,
  relation_type public.plant_relation_type NOT NULL DEFAULT 'geradora',
  allocation_percent numeric,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_unit_plant_links_unit ON public.unit_plant_links(tenant_id, unit_id, is_active);

ALTER TABLE public.unit_plant_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upl_tenant_select" ON public.unit_plant_links FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "upl_tenant_insert" ON public.unit_plant_links FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "upl_tenant_update" ON public.unit_plant_links FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "upl_tenant_delete" ON public.unit_plant_links FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- 7. unit_billing_email_settings
-- ============================================================
CREATE TABLE public.unit_billing_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE UNIQUE,
  billing_capture_email text,
  forward_to_email text,
  pdf_password text,
  email_billing_enabled boolean NOT NULL DEFAULT false,
  setup_status public.billing_setup_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

ALTER TABLE public.unit_billing_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ubes_tenant_select" ON public.unit_billing_email_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ubes_tenant_insert" ON public.unit_billing_email_settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ubes_tenant_update" ON public.unit_billing_email_settings FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- 8. unit_invoices
-- ============================================================
CREATE TABLE public.unit_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  reference_month int NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year int NOT NULL CHECK (reference_year BETWEEN 2000 AND 2100),
  due_date date,
  total_amount numeric,
  energy_consumed_kwh numeric,
  energy_injected_kwh numeric,
  compensated_kwh numeric,
  previous_balance_kwh numeric,
  current_balance_kwh numeric,
  pdf_file_url text,
  source public.invoice_source DEFAULT 'manual',
  source_message_id text,
  raw_extraction jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id, reference_month, reference_year)
);

CREATE INDEX idx_unit_invoices_unit ON public.unit_invoices(tenant_id, unit_id);
CREATE INDEX idx_unit_invoices_period ON public.unit_invoices(tenant_id, reference_year, reference_month);

ALTER TABLE public.unit_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_tenant_select" ON public.unit_invoices FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "inv_tenant_insert" ON public.unit_invoices FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "inv_tenant_update" ON public.unit_invoices FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "inv_tenant_delete" ON public.unit_invoices FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- ============================================================
-- 9. integration_sync_runs
-- ============================================================
CREATE TABLE public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  integration_config_id uuid,
  sync_type text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_processed int NOT NULL DEFAULT 0,
  items_created int NOT NULL DEFAULT 0,
  items_updated int NOT NULL DEFAULT 0,
  items_failed int NOT NULL DEFAULT 0,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_integration_sync_runs_tenant ON public.integration_sync_runs(tenant_id, provider, started_at DESC);

ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isr_tenant_select" ON public.integration_sync_runs FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "isr_tenant_insert" ON public.integration_sync_runs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "isr_tenant_update" ON public.integration_sync_runs FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_units_consumidoras BEFORE UPDATE ON public.units_consumidoras FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_meter_devices BEFORE UPDATE ON public.meter_devices FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_unit_meter_links BEFORE UPDATE ON public.unit_meter_links FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_unit_billing BEFORE UPDATE ON public.unit_billing_email_settings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_unit_invoices BEFORE UPDATE ON public.unit_invoices FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER set_updated_at_unit_plant_links BEFORE UPDATE ON public.unit_plant_links FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
