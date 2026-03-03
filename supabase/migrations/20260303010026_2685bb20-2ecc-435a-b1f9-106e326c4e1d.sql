
-- Trigger to auto-populate solar_plant_id on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.populate_solar_plant_id_on_event()
RETURNS TRIGGER AS $$
DECLARE
  mapped_solar_plant_id UUID;
BEGIN
  -- If solar_plant_id is already set, preserve monitor_plant_id and return
  IF NEW.solar_plant_id IS NOT NULL THEN
    IF NEW.monitor_plant_id IS NULL AND NEW.plant_id IS NOT NULL THEN
      NEW.monitor_plant_id := NEW.plant_id;
    END IF;
    RETURN NEW;
  END IF;

  -- If plant_id is NULL, cannot map
  IF NEW.plant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- First check if plant_id is directly a solar_plants.id
  PERFORM 1 FROM solar_plants WHERE id = NEW.plant_id;
  IF FOUND THEN
    NEW.solar_plant_id := NEW.plant_id;
    NEW.monitor_plant_id := COALESCE(NEW.monitor_plant_id, NEW.plant_id);
    RETURN NEW;
  END IF;

  -- Otherwise map via monitor_plants.legacy_plant_id
  SELECT mp.legacy_plant_id
  INTO mapped_solar_plant_id
  FROM monitor_plants mp
  WHERE mp.id = NEW.plant_id;

  IF mapped_solar_plant_id IS NOT NULL THEN
    NEW.solar_plant_id := mapped_solar_plant_id;
    NEW.monitor_plant_id := NEW.plant_id;
  ELSE
    RAISE LOG 'monitor_events: Failed to map solar_plant_id for plant_id %', NEW.plant_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_monitor_events_populate_solar_plant_id
BEFORE INSERT OR UPDATE ON monitor_events
FOR EACH ROW
EXECUTE FUNCTION public.populate_solar_plant_id_on_event();
