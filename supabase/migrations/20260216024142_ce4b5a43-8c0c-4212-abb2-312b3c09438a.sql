-- RPC to purge all irradiance data for a dataset (bypasses PostgREST row limits)
CREATE OR REPLACE FUNCTION public.purge_irradiance_dataset(_dataset_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _is_admin boolean;
  _points_deleted bigint;
  _versions_deleted bigint;
  _cache_deleted bigint;
  _jobs_deleted bigint;
  _dataset_code text;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0401';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = 'P0403';
  END IF;

  -- Get dataset code for job cleanup
  SELECT code INTO _dataset_code FROM irradiance_datasets WHERE id = _dataset_id;
  IF _dataset_code IS NULL THEN
    RAISE EXCEPTION 'Dataset not found' USING ERRCODE = 'P0404';
  END IF;

  -- 1. Delete all points for all versions of this dataset
  WITH deleted AS (
    DELETE FROM irradiance_points_monthly
    WHERE version_id IN (SELECT id FROM irradiance_dataset_versions WHERE dataset_id = _dataset_id)
    RETURNING 1
  ) SELECT COUNT(*) INTO _points_deleted FROM deleted;

  -- 2. Delete cache
  WITH deleted AS (
    DELETE FROM irradiance_lookup_cache
    WHERE version_id IN (SELECT id FROM irradiance_dataset_versions WHERE dataset_id = _dataset_id)
    RETURNING 1
  ) SELECT COUNT(*) INTO _cache_deleted FROM deleted;

  -- 3. Delete import jobs
  WITH deleted AS (
    DELETE FROM solar_import_jobs WHERE dataset_key = _dataset_code
    RETURNING 1
  ) SELECT COUNT(*) INTO _jobs_deleted FROM deleted;

  -- 4. Delete versions
  WITH deleted AS (
    DELETE FROM irradiance_dataset_versions WHERE dataset_id = _dataset_id
    RETURNING 1
  ) SELECT COUNT(*) INTO _versions_deleted FROM deleted;

  RETURN json_build_object(
    'points_deleted', _points_deleted,
    'versions_deleted', _versions_deleted,
    'cache_deleted', _cache_deleted,
    'jobs_deleted', _jobs_deleted
  );
END;
$function$;