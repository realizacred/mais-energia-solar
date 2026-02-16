-- ============================================================
-- FASE 2: HARDENING — RPC Canônica + Guardrails de Mistura
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 2A) RPC CANÔNICA: get_irradiance_for_simulation
-- Ponto único de acesso para busca de irradiância.
-- Impede mistura: valida version_id, retorna metadados completos,
-- grava cache, e retorna tudo que o motor de cálculo precisa.
-- ──────────────────────────────────────────────────────────

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

  -- 2. Find nearest point (reuses existing Haversine logic)
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
      LEAST(1, cos(radians(_lat)) * cos(radians(p.lat)) *
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
    RAISE EXCEPTION 'No irradiance data found within % degrees of (%, %) for version %',
      _radius_deg, _lat, _lon, _version_id
      USING ERRCODE = 'P0404';
  END IF;

  -- 3. Build complete result with metadata
  _result := json_build_object(
    -- Source metadata (for traceability)
    'dataset_code', _dataset_code,
    'dataset_name', _dataset_name,
    'version_id', _version_id,
    'version_tag', _version_tag,
    'method', _method,
    'plane', _point.plane,
    'units', _point.unit,
    -- Point location
    'point_id', _point.point_id,
    'source_lat', _point.lat,
    'source_lon', _point.lon,
    'request_lat', _lat,
    'request_lon', _lon,
    'distance_km', _point.distance_km,
    -- Data availability flags
    'has_dhi', _has_dhi,
    'has_dni', _has_dni,
    'dhi_available', (_point.dhi_m01 IS NOT NULL),
    'dni_available', (_point.dni_m01 IS NOT NULL),
    -- GHI monthly series
    'ghi', json_build_object(
      'm01', _point.m01, 'm02', _point.m02, 'm03', _point.m03,
      'm04', _point.m04, 'm05', _point.m05, 'm06', _point.m06,
      'm07', _point.m07, 'm08', _point.m08, 'm09', _point.m09,
      'm10', _point.m10, 'm11', _point.m11, 'm12', _point.m12
    ),
    -- DHI monthly series (null-safe)
    'dhi', json_build_object(
      'm01', _point.dhi_m01, 'm02', _point.dhi_m02, 'm03', _point.dhi_m03,
      'm04', _point.dhi_m04, 'm05', _point.dhi_m05, 'm06', _point.dhi_m06,
      'm07', _point.dhi_m07, 'm08', _point.dhi_m08, 'm09', _point.dhi_m09,
      'm10', _point.dhi_m10, 'm11', _point.dhi_m11, 'm12', _point.dhi_m12
    ),
    -- DNI monthly series (null-safe)
    'dni', json_build_object(
      'm01', _point.dni_m01, 'm02', _point.dni_m02, 'm03', _point.dni_m03,
      'm04', _point.dni_m04, 'm05', _point.dni_m05, 'm06', _point.dni_m06,
      'm07', _point.dni_m07, 'm08', _point.dni_m08, 'm09', _point.dni_m09,
      'm10', _point.dni_m10, 'm11', _point.dni_m11, 'm12', _point.dni_m12
    ),
    -- Yearly averages
    'ghi_annual_avg', ((_point.m01 + _point.m02 + _point.m03 + _point.m04 +
      _point.m05 + _point.m06 + _point.m07 + _point.m08 + _point.m09 +
      _point.m10 + _point.m11 + _point.m12) / 12)::numeric(10,4)
  );

  -- 4. Cache the lookup (upsert)
  INSERT INTO irradiance_lookup_cache (version_id, lat_round, lon_round, method, series, point_lat, point_lon, distance_km)
  VALUES (
    _version_id,
    round(_lat, 2),
    round(_lon, 2),
    _method,
    _result,
    _point.lat,
    _point.lon,
    _point.distance_km
  )
  ON CONFLICT DO NOTHING;

  RETURN _result;
END;
$$;

COMMENT ON FUNCTION public.get_irradiance_for_simulation IS 
'Canonical RPC for irradiance lookup. Returns GHI/DHI/DNI + full metadata for traceability. 
Prevents dataset mixing by requiring a single version_id. Caches results automatically.';