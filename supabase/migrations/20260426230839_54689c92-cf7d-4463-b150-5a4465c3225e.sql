CREATE OR REPLACE FUNCTION public.sm_try_claim_promotion_step(
  _job_id uuid,
  _tenant_id uuid,
  _lease_seconds integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed boolean := false;
BEGIN
  WITH upd AS (
    UPDATE public.solarmarket_promotion_jobs
    SET
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'step_lock_until', (now() + make_interval(secs => GREATEST(_lease_seconds, 30)))::text,
        'step_lock_acquired_at', now()::text
      ),
      last_step_at = now(),
      updated_at = now()
    WHERE id = _job_id
      AND tenant_id = _tenant_id
      AND status = 'running'
      AND (
        metadata->>'step_lock_until' IS NULL
        OR (metadata->>'step_lock_until')::timestamptz < now()
      )
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM upd) INTO _claimed;

  RETURN _claimed;
END;
$$;

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
      metadata = GREATEST(COALESCE(metadata, '{}'::jsonb) - 'step_lock_until' - 'step_lock_acquired_at', '{}'::jsonb),
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