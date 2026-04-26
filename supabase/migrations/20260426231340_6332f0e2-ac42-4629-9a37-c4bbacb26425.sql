CREATE OR REPLACE FUNCTION public.sm_release_promotion_step(
  _job_id uuid,
  _tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _released boolean := false;
BEGIN
  WITH upd AS (
    UPDATE public.solarmarket_promotion_jobs
    SET
      metadata = COALESCE(metadata, '{}'::jsonb) - 'step_lock_until' - 'step_lock_acquired_at',
      last_step_at = now(),
      updated_at = now()
    WHERE id = _job_id
      AND tenant_id = _tenant_id
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM upd) INTO _released;

  RETURN _released;
END;
$$;

REVOKE ALL ON FUNCTION public.sm_try_claim_promotion_step(uuid, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sm_release_promotion_step(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sm_try_claim_promotion_step(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.sm_release_promotion_step(uuid, uuid) TO service_role;