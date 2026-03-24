-- 1. Trigger: sync categoria_gd from gd_groups to UC (geradora) on insert/update
CREATE OR REPLACE FUNCTION public.sync_gd_group_categoria_to_uc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When gd_groups.categoria_gd changes, update the UC geradora
  IF NEW.categoria_gd IS DISTINCT FROM OLD.categoria_gd OR TG_OP = 'INSERT' THEN
    UPDATE units_consumidoras
    SET categoria_gd = NEW.categoria_gd,
        updated_at = now()
    WHERE id = NEW.uc_geradora_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gd_categoria ON public.gd_groups;
CREATE TRIGGER trg_sync_gd_categoria
  AFTER INSERT OR UPDATE OF categoria_gd ON public.gd_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gd_group_categoria_to_uc();

-- 2. Unique constraint: prevent duplicate daily meter readings (if materialized)
-- The VIEW already handles this, but add unique index on meter_readings to prevent
-- duplicate raw readings at same timestamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_meter_readings_device_timestamp
  ON public.meter_readings (meter_device_id, measured_at);

-- 3. Unique constraint: one active group per UC geradora
CREATE UNIQUE INDEX IF NOT EXISTS idx_gd_groups_active_uc_geradora
  ON public.gd_groups (uc_geradora_id)
  WHERE status = 'active';