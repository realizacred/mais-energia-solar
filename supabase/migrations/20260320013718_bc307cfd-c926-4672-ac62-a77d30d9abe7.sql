
-- Fix 1: Cast text to meter_link_type enum in RPC
CREATE OR REPLACE FUNCTION public.link_meter_to_unit(p_unit_id uuid, p_meter_device_id uuid, p_link_type text DEFAULT 'principal')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_link_id uuid;
BEGIN
  v_tenant_id := current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  PERFORM 1 FROM units_consumidoras WHERE id = p_unit_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'UC não encontrada'; END IF;

  PERFORM 1 FROM meter_devices WHERE id = p_meter_device_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Medidor não encontrado'; END IF;

  IF p_link_type = 'principal' THEN
    UPDATE unit_meter_links
    SET is_active = false, ended_at = now(), updated_at = now()
    WHERE meter_device_id = p_meter_device_id
      AND is_active = true
      AND link_type = 'principal'
      AND tenant_id = v_tenant_id;
  END IF;

  INSERT INTO unit_meter_links (tenant_id, unit_id, meter_device_id, link_type, started_at, is_active)
  VALUES (v_tenant_id, p_unit_id, p_meter_device_id, p_link_type::meter_link_type, now(), true)
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$;

-- Fix 2: Set default tenant_id on unit_plant_links so RLS insert works
ALTER TABLE public.unit_plant_links ALTER COLUMN tenant_id SET DEFAULT current_tenant_id();
