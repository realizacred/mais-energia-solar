
DROP FUNCTION IF EXISTS public.irradiance_nearest_point(uuid, numeric, numeric, numeric);

CREATE FUNCTION public.irradiance_nearest_point(
  p_version_id uuid,
  p_lat numeric,
  p_lon numeric,
  p_radius_deg numeric DEFAULT 0.5
)
RETURNS TABLE(
  point_id bigint,
  lat numeric, lon numeric,
  m01 numeric, m02 numeric, m03 numeric, m04 numeric,
  m05 numeric, m06 numeric, m07 numeric, m08 numeric,
  m09 numeric, m10 numeric, m11 numeric, m12 numeric,
  dhi_m01 numeric, dhi_m02 numeric, dhi_m03 numeric, dhi_m04 numeric,
  dhi_m05 numeric, dhi_m06 numeric, dhi_m07 numeric, dhi_m08 numeric,
  dhi_m09 numeric, dhi_m10 numeric, dhi_m11 numeric, dhi_m12 numeric,
  unit text,
  distance_km numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id AS point_id,
    p.lat, p.lon,
    p.m01, p.m02, p.m03, p.m04,
    p.m05, p.m06, p.m07, p.m08,
    p.m09, p.m10, p.m11, p.m12,
    p.dhi_m01, p.dhi_m02, p.dhi_m03, p.dhi_m04,
    p.dhi_m05, p.dhi_m06, p.dhi_m07, p.dhi_m08,
    p.dhi_m09, p.dhi_m10, p.dhi_m11, p.dhi_m12,
    p.unit,
    (6371 * acos(
      LEAST(1, cos(radians(p_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lon) - radians(p_lon)) +
      sin(radians(p_lat)) * sin(radians(p.lat)))
    ))::numeric(10,3) AS distance_km
  FROM public.irradiance_points_monthly p
  WHERE p.version_id = p_version_id
    AND p.lat BETWEEN (p_lat - p_radius_deg) AND (p_lat + p_radius_deg)
    AND p.lon BETWEEN (p_lon - p_radius_deg) AND (p_lon + p_radius_deg)
  ORDER BY distance_km ASC
  LIMIT 1;
$$;
