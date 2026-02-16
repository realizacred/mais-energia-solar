
DROP FUNCTION IF EXISTS public.activate_irradiance_version(uuid);

CREATE OR REPLACE FUNCTION public.activate_irradiance_version(_version_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_admin boolean;
  _dataset_id uuid;
  _row_count int;
  _current_active_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0401';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  ) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = 'P0403';
  END IF;

  SELECT dataset_id, row_count INTO _dataset_id, _row_count
  FROM irradiance_dataset_versions WHERE id = _version_id AND status = 'processing';

  IF _dataset_id IS NULL THEN
    RAISE EXCEPTION 'Version not found or not in processing state' USING ERRCODE = 'P0404';
  END IF;

  IF _row_count <= 0 THEN
    RAISE EXCEPTION 'Cannot activate version with 0 rows' USING ERRCODE = 'P0422';
  END IF;

  SELECT id INTO _current_active_id
  FROM irradiance_dataset_versions
  WHERE dataset_id = _dataset_id AND status = 'active';

  IF _current_active_id IS NOT NULL THEN
    UPDATE irradiance_dataset_versions
    SET status = 'archived', updated_at = now()
    WHERE id = _current_active_id;
  END IF;

  UPDATE irradiance_dataset_versions
  SET status = 'active', updated_at = now()
  WHERE id = _version_id;

  RETURN json_build_object('ok', true, 'row_count', _row_count, 'version_id', _version_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_irradiance_version(uuid) TO authenticated;
