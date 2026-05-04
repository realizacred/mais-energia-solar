CREATE OR REPLACE FUNCTION public.eej_try_lock(p_key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(p_key);
$$;

CREATE OR REPLACE FUNCTION public.eej_unlock(p_key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(p_key);
$$;

GRANT EXECUTE ON FUNCTION public.eej_try_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.eej_unlock(bigint) TO service_role;