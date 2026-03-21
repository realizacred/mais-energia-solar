-- RPC to get monitoring data for a UC via public token
-- Returns: plants (status, generation), meters (status), daily readings (7 days)
CREATE OR REPLACE FUNCTION public.resolve_uc_monitoring(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tok uc_client_tokens%ROWTYPE;
  v_plants JSON;
  v_meters JSON;
  v_daily JSON;
  v_today_kwh NUMERIC;
  v_month_kwh NUMERIC;
BEGIN
  -- Validate token
  SELECT * INTO v_tok FROM uc_client_tokens
  WHERE token = p_token AND is_active = true AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN RETURN json_build_object('error', 'invalid_token'); END IF;

  -- Get linked plants with status info
  SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json) INTO v_plants
  FROM (
    SELECT mp.id, mp.name, mp.installed_power_kwp,
           mp.is_active, mp.last_seen_at, mp.provider_id,
           upl.allocation_percent
    FROM unit_plant_links upl
    JOIN monitor_plants mp ON mp.id = upl.plant_id
    WHERE upl.unit_id = v_tok.unit_id AND upl.is_active = true
    ORDER BY mp.name
  ) p;

  -- Get linked meters with status info
  SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json) INTO v_meters
  FROM (
    SELECT md.id, md.name, md.model, md.manufacturer, md.serial_number,
           md.online_status, md.last_seen_at, md.last_reading_at
    FROM unit_meter_links uml
    JOIN meter_devices md ON md.id = uml.meter_device_id
    WHERE uml.unit_id = v_tok.unit_id AND uml.is_active = true
    ORDER BY md.name
  ) m;

  -- Get daily readings (last 7 days) for linked plants
  SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json) INTO v_daily
  FROM (
    SELECT mrd.date, SUM(mrd.energy_kwh) as energy_kwh, SUM(mrd.peak_power_kw) as peak_power_kw
    FROM monitor_readings_daily mrd
    WHERE mrd.plant_id IN (
      SELECT upl.plant_id FROM unit_plant_links upl
      WHERE upl.unit_id = v_tok.unit_id AND upl.is_active = true
    )
    AND mrd.date >= (CURRENT_DATE - INTERVAL '7 days')
    GROUP BY mrd.date
    ORDER BY mrd.date
  ) d;

  -- Today's generation
  SELECT COALESCE(SUM(mrd.energy_kwh), 0) INTO v_today_kwh
  FROM monitor_readings_daily mrd
  WHERE mrd.plant_id IN (
    SELECT upl.plant_id FROM unit_plant_links upl
    WHERE upl.unit_id = v_tok.unit_id AND upl.is_active = true
  )
  AND mrd.date = CURRENT_DATE;

  -- This month's generation
  SELECT COALESCE(SUM(mrd.energy_kwh), 0) INTO v_month_kwh
  FROM monitor_readings_daily mrd
  WHERE mrd.plant_id IN (
    SELECT upl.plant_id FROM unit_plant_links upl
    WHERE upl.unit_id = v_tok.unit_id AND upl.is_active = true
  )
  AND mrd.date >= date_trunc('month', CURRENT_DATE)
  AND mrd.date <= CURRENT_DATE;

  RETURN json_build_object(
    'plants', v_plants,
    'meters', v_meters,
    'daily', v_daily,
    'today_kwh', v_today_kwh,
    'month_kwh', v_month_kwh
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_uc_monitoring(TEXT) TO anon;