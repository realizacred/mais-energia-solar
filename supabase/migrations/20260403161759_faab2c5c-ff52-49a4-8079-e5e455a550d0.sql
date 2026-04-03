CREATE OR REPLACE FUNCTION public.ensure_user_role_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL
     OR NEW.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    SELECT p.tenant_id
      INTO NEW.tenant_id
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_user_role_tenant ON public.user_roles;

CREATE TRIGGER trg_ensure_user_role_tenant
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_role_tenant();

UPDATE public.user_roles ur
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE p.user_id = ur.user_id
  AND ur.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid;