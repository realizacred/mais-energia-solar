-- Function to auto-mark stuck processing versions as failed
CREATE OR REPLACE FUNCTION public.cleanup_stuck_irradiance_versions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  WITH updated AS (
    UPDATE irradiance_dataset_versions
    SET status = 'failed',
        metadata = metadata || jsonb_build_object(
          'failure_reason', 'auto_cleanup_stuck_processing',
          'failed_at', now()::text
        )
    WHERE status = 'processing'
      AND row_count = 0
      AND created_at < now() - interval '2 hours'
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM updated;
  
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_stuck_irradiance_versions() TO authenticated;