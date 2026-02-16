
-- ================================================================
-- RPC: reset_solar_data_layer
-- Atomic cleanup of all meteorological data (RAW + cache + POA).
-- Admin-only, requires confirmation text 'LIMPAR'.
-- ================================================================

CREATE OR REPLACE FUNCTION public.reset_solar_data_layer(_confirm text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_admin boolean;
  _points_before bigint;
  _cache_before bigint;
  _poa_before bigint;
  _versions_before bigint;
BEGIN
  -- 1. Auth check
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0401';
  END IF;

  -- 2. Confirmation check
  IF _confirm IS DISTINCT FROM 'LIMPAR' THEN
    RAISE EXCEPTION 'Texto de confirmação incorreto. Digite exatamente "LIMPAR".' USING ERRCODE = 'P0400';
  END IF;

  -- 3. Admin role check (uses existing user_roles table)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  ) INTO _is_admin;

  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta operação.' USING ERRCODE = 'P0403';
  END IF;

  -- 4. Capture counts before cleanup
  SELECT count(*) INTO _points_before FROM public.irradiance_points_monthly;
  SELECT count(*) INTO _cache_before FROM public.irradiance_lookup_cache;
  SELECT count(*) INTO _poa_before FROM public.irradiance_transposed_monthly;
  SELECT count(*) INTO _versions_before FROM public.irradiance_dataset_versions;

  -- 5. Atomic cleanup (FK order: transposed → cache → points)
  DELETE FROM public.irradiance_transposed_monthly;
  DELETE FROM public.irradiance_lookup_cache;
  DELETE FROM public.irradiance_points_monthly;

  -- 6. Reset version statuses
  UPDATE public.irradiance_dataset_versions
  SET status = 'archived', updated_at = now()
  WHERE status = 'active';

  UPDATE public.irradiance_dataset_versions
  SET status = 'failed', updated_at = now()
  WHERE status = 'processing';

  RETURN json_build_object(
    'success', true,
    'message', 'Base meteorológica limpa com sucesso.',
    'deleted', json_build_object(
      'points', _points_before,
      'cache', _cache_before,
      'poa', _poa_before,
      'versions_archived', _versions_before
    ),
    'executed_by', _user_id,
    'executed_at', now()
  );
END;
$$;

-- Grant execute to authenticated (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.reset_solar_data_layer(text) TO authenticated;
