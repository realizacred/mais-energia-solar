
-- 1) Add new columns
ALTER TABLE monitor_events ADD COLUMN IF NOT EXISTS monitor_plant_id UUID NULL;
ALTER TABLE monitor_events ADD COLUMN IF NOT EXISTS solar_plant_id UUID NULL;

-- 2) Backfill from monitor_plants
UPDATE monitor_events me
SET
  monitor_plant_id = me.plant_id,
  solar_plant_id = mp.legacy_plant_id
FROM monitor_plants mp
WHERE mp.id = me.plant_id
  AND me.solar_plant_id IS NULL;

-- 3) Edge case: plant_id directly in solar_plants
UPDATE monitor_events me
SET
  monitor_plant_id = COALESCE(me.monitor_plant_id, me.plant_id),
  solar_plant_id = me.plant_id
FROM solar_plants sp
WHERE sp.id = me.plant_id
  AND me.solar_plant_id IS NULL;

-- 4) Index
CREATE INDEX IF NOT EXISTS idx_monitor_events_solar_plant_tenant_open
  ON monitor_events (tenant_id, solar_plant_id, is_open);

-- 5) Drop old RPC (different return signature) then recreate
DROP FUNCTION IF EXISTS public.fn_monitor_open_alert_counts(uuid);

CREATE FUNCTION public.fn_monitor_open_alert_counts(_tenant_id uuid)
RETURNS TABLE(solar_plant_id uuid, open_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(me.solar_plant_id, mp.legacy_plant_id) AS solar_plant_id,
    count(*)::int AS open_count
  FROM monitor_events me
  LEFT JOIN monitor_plants mp ON mp.id = me.plant_id
  WHERE me.tenant_id = _tenant_id
    AND me.is_open = true
  GROUP BY COALESCE(me.solar_plant_id, mp.legacy_plant_id);
$$;
