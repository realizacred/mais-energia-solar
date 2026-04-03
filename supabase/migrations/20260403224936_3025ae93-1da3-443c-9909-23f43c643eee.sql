
-- Create overload of get_user_tenant_id() without arguments
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_user_tenant_id(auth.uid())
$$;
