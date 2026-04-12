
-- Add is_default column
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Ensure only one default per tenant via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_one_default_per_tenant
  ON public.pipelines (tenant_id)
  WHERE is_default = true;

-- Trigger: when setting is_default=true, unset others in same tenant
CREATE OR REPLACE FUNCTION public.enforce_single_default_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.pipelines
    SET is_default = false
    WHERE tenant_id = NEW.tenant_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_default_pipeline ON public.pipelines;
CREATE TRIGGER trg_enforce_single_default_pipeline
  BEFORE INSERT OR UPDATE OF is_default ON public.pipelines
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_pipeline();

-- Set first pipeline per tenant as default (seed existing data)
WITH first_per_tenant AS (
  SELECT DISTINCT ON (tenant_id) id
  FROM public.pipelines
  WHERE is_active = true
  ORDER BY tenant_id, created_at
)
UPDATE public.pipelines p
SET is_default = true
FROM first_per_tenant f
WHERE p.id = f.id;
