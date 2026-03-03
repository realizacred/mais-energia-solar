CREATE OR REPLACE FUNCTION public.fn_monitor_open_alert_counts(_tenant_id uuid)
RETURNS TABLE(plant_id uuid, open_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT me.plant_id, count(*)::int AS open_count
  FROM monitor_events me
  WHERE me.tenant_id = _tenant_id
    AND me.is_open = true
  GROUP BY me.plant_id;
$$;