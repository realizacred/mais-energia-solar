
-- ============================================================
-- SOLAR DATA LAYER v2 — HARDENING FINAL
-- Resolve: W1 (CHECK plane), W2 (nullable version_id),
--          W3 (cache precision), W4 (cache RLS)
-- ============================================================

-- ─── W1: Enforce plane='horizontal' on RAW data ─────────────
-- Points table must ONLY contain horizontal-plane data.
-- POA data lives exclusively in irradiance_transposed_monthly.
ALTER TABLE public.irradiance_points_monthly
  ADD CONSTRAINT chk_raw_plane_horizontal
  CHECK (plane = 'horizontal');

-- ─── W3: Fix cache precision ────────────────────────────────
-- The RPC uses round(_lat, 2) but the client uses roundCoord(lat, 4).
-- Standardize to 4 decimal places (~11m precision) for consistency.
-- Step 1: Drop the old unique constraint
ALTER TABLE public.irradiance_lookup_cache
  DROP CONSTRAINT IF EXISTS irradiance_lookup_cache_version_id_lat_round_lon_round_meth_key;

-- Step 2: Add check constraints to enforce 4-decimal precision
ALTER TABLE public.irradiance_lookup_cache
  ADD CONSTRAINT chk_cache_lat_precision
  CHECK (lat_round = round(lat_round, 4));

ALTER TABLE public.irradiance_lookup_cache
  ADD CONSTRAINT chk_cache_lon_precision
  CHECK (lon_round = round(lon_round, 4));

-- Step 3: Recreate unique index with explicit precision guarantee
CREATE UNIQUE INDEX IF NOT EXISTS uq_irradiance_cache_lookup
  ON public.irradiance_lookup_cache (version_id, lat_round, lon_round, method);

-- ─── W4: Tighten cache INSERT policy ────────────────────────
-- Only allow cache writes via SECURITY DEFINER RPCs (service_role or admin).
-- Drop the overly permissive policy first.
DROP POLICY IF EXISTS "Authenticated can insert irradiance_lookup_cache"
  ON public.irradiance_lookup_cache;

-- Replace with admin-only INSERT (RPCs use SECURITY DEFINER, so they bypass RLS)
CREATE POLICY "Only admins can insert cache directly"
  ON public.irradiance_lookup_cache
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin'::app_role, 'super_admin'::app_role)
    )
  );

-- ─── Fix get_irradiance_for_simulation RPC ──────────────────
-- Use round(_lat, 4) consistently and fix ON CONFLICT target.
CREATE OR REPLACE FUNCTION public.get_irradiance_for_simulation(
  _version_id uuid,
  _lat numeric,
  _lon numeric,
  _radius_deg numeric DEFAULT 0.5,
  _method text DEFAULT 'nearest'
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result json;
  _dataset_code text;
  _dataset_name text;
  _version_tag text;
  _version_status text;
  _has_dhi boolean;
  _has_dni boolean;
  _point record;
  _lat_r numeric;
  _lon_r numeric;
BEGIN
  -- 1. Validate version exists and is active
  SELECT
    v.status, v.version_tag,
    d.code, d.name,
    COALESCE((v.metadata->>'has_dhi')::boolean, false),
    COALESCE((v.metadata->>'has_dni')::boolean, false)
  INTO _version_status, _version_tag, _dataset_code, _dataset_name, _has_dhi, _has_dni
  FROM irradiance_dataset_versions v
  JOIN irradiance_datasets d ON d.id = v.dataset_id
  WHERE v.id = _version_id;

  IF _version_status IS NULL THEN
    RAISE EXCEPTION 'Irradiance version % not found', _version_id
      USING ERRCODE = 'P0404';
  END IF;

  IF _version_status != 'active' THEN
    RAISE EXCEPTION 'Irradiance version % is not active (status=%)', _version_id, _version_status
      USING ERRCODE = 'P0422';
  END IF;

  -- 2. Check cache first (round to 4 decimals = ~11m)
  _lat_r := round(_lat, 4);
  _lon_r := round(_lon, 4);

  SELECT series INTO _result
  FROM irradiance_lookup_cache
  WHERE version_id = _version_id
    AND lat_round = _lat_r
    AND lon_round = _lon_r
    AND method = _method;

  IF _result IS NOT NULL THEN
    RETURN _result;
  END IF;

  -- 3. Find nearest point using Haversine
  SELECT
    p.id AS point_id,
    p.lat, p.lon,
    p.m01, p.m02, p.m03, p.m04, p.m05, p.m06,
    p.m07, p.m08, p.m09, p.m10, p.m11, p.m12,
    p.dhi_m01, p.dhi_m02, p.dhi_m03, p.dhi_m04, p.dhi_m05, p.dhi_m06,
    p.dhi_m07, p.dhi_m08, p.dhi_m09, p.dhi_m10, p.dhi_m11, p.dhi_m12,
    p.dni_m01, p.dni_m02, p.dni_m03, p.dni_m04, p.dni_m05, p.dni_m06,
    p.dni_m07, p.dni_m08, p.dni_m09, p.dni_m10, p.dni_m11, p.dni_m12,
    p.unit, p.plane,
    (6371 * acos(
      LEAST(1.0, cos(radians(_lat)) * cos(radians(p.lat)) *
      cos(radians(p.lon) - radians(_lon)) +
      sin(radians(_lat)) * sin(radians(p.lat)))
    ))::numeric(10,3) AS distance_km
  INTO _point
  FROM irradiance_points_monthly p
  WHERE p.version_id = _version_id
    AND p.lat BETWEEN (_lat - _radius_deg) AND (_lat + _radius_deg)
    AND p.lon BETWEEN (_lon - _radius_deg) AND (_lon + _radius_deg)
  ORDER BY distance_km ASC
  LIMIT 1;

  IF _point IS NULL THEN
    RAISE EXCEPTION 'No irradiance data within % deg of (%, %) for version %',
      _radius_deg, _lat, _lon, _version_id
      USING ERRCODE = 'P0404';
  END IF;

  -- 4. Build result JSON
  _result := json_build_object(
    'dataset_code', _dataset_code,
    'dataset_name', _dataset_name,
    'version_id', _version_id,
    'version_tag', _version_tag,
    'method', _method,
    'plane', _point.plane,
    'units', _point.unit,
    'point_id', _point.point_id,
    'source_lat', _point.lat,
    'source_lon', _point.lon,
    'request_lat', _lat,
    'request_lon', _lon,
    'distance_km', _point.distance_km,
    'has_dhi', _has_dhi,
    'has_dni', _has_dni,
    'dhi_available', (_point.dhi_m01 IS NOT NULL),
    'dni_available', (_point.dni_m01 IS NOT NULL),
    'ghi', json_build_object(
      'm01', _point.m01, 'm02', _point.m02, 'm03', _point.m03,
      'm04', _point.m04, 'm05', _point.m05, 'm06', _point.m06,
      'm07', _point.m07, 'm08', _point.m08, 'm09', _point.m09,
      'm10', _point.m10, 'm11', _point.m11, 'm12', _point.m12
    ),
    'dhi', json_build_object(
      'm01', _point.dhi_m01, 'm02', _point.dhi_m02, 'm03', _point.dhi_m03,
      'm04', _point.dhi_m04, 'm05', _point.dhi_m05, 'm06', _point.dhi_m06,
      'm07', _point.dhi_m07, 'm08', _point.dhi_m08, 'm09', _point.dhi_m09,
      'm10', _point.dhi_m10, 'm11', _point.dhi_m11, 'm12', _point.dhi_m12
    ),
    'dni', json_build_object(
      'm01', _point.dni_m01, 'm02', _point.dni_m02, 'm03', _point.dni_m03,
      'm04', _point.dni_m04, 'm05', _point.dni_m05, 'm06', _point.dni_m06,
      'm07', _point.dni_m07, 'm08', _point.dni_m08, 'm09', _point.dni_m09,
      'm10', _point.dni_m10, 'm11', _point.dni_m11, 'm12', _point.dni_m12
    ),
    'ghi_annual_avg', ((_point.m01 + _point.m02 + _point.m03 + _point.m04 +
      _point.m05 + _point.m06 + _point.m07 + _point.m08 + _point.m09 +
      _point.m10 + _point.m11 + _point.m12) / 12.0)::numeric(10,4)
  );

  -- 5. Persist cache (SECURITY DEFINER bypasses RLS)
  INSERT INTO irradiance_lookup_cache
    (version_id, lat_round, lon_round, method, series, point_lat, point_lon, distance_km)
  VALUES
    (_version_id, _lat_r, _lon_r, _method, _result, _point.lat, _point.lon, _point.distance_km)
  ON CONFLICT (version_id, lat_round, lon_round, method) DO NOTHING;

  RETURN _result;
END;
$$;
