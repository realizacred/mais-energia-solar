
-- Bridge: populate monitor_plants from solar_plants
-- Use DO block for safe upsert with partial unique index
DO $$
DECLARE
  rec RECORD;
  existing_id UUID;
BEGIN
  FOR rec IN
    SELECT * FROM public.solar_plants WHERE integration_id IS NOT NULL
  LOOP
    -- Check if already bridged
    SELECT id INTO existing_id
    FROM public.monitor_plants
    WHERE tenant_id = rec.tenant_id AND legacy_plant_id = rec.id;

    IF existing_id IS NOT NULL THEN
      -- Update existing
      UPDATE public.monitor_plants SET
        name = COALESCE(rec.name, 'Usina'),
        lat = rec.latitude, lng = rec.longitude, city = rec.address,
        installed_power_kwp = rec.capacity_kw,
        provider_id = rec.provider, provider_plant_id = rec.external_id,
        last_seen_at = rec.updated_at,
        metadata = COALESCE(rec.metadata, '{}'),
        updated_at = now()
      WHERE id = existing_id;
    ELSE
      -- Insert new
      INSERT INTO public.monitor_plants (
        tenant_id, name, lat, lng, city, installed_power_kwp,
        provider_id, provider_plant_id, is_active, metadata,
        legacy_plant_id, last_seen_at, created_at, updated_at
      ) VALUES (
        rec.tenant_id, COALESCE(rec.name, 'Usina'),
        rec.latitude, rec.longitude, rec.address, rec.capacity_kw,
        rec.provider, rec.external_id, true,
        COALESCE(rec.metadata, '{}'), rec.id,
        rec.updated_at, rec.created_at, rec.updated_at
      );
    END IF;
  END LOOP;
END $$;
