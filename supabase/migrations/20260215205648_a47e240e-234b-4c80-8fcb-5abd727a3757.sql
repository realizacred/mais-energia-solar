-- Auto-resolve tenant_id on INSERT for tenant_premises
CREATE OR REPLACE FUNCTION public.resolve_tenant_premises_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_tenant_premises_tenant_id
  BEFORE INSERT ON public.tenant_premises
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_tenant_premises_tenant_id();

-- Same for tenant_roof_area_factors
CREATE OR REPLACE FUNCTION public.resolve_tenant_roof_factors_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_tenant_roof_factors_tenant_id
  BEFORE INSERT ON public.tenant_roof_area_factors
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_tenant_roof_factors_tenant_id();