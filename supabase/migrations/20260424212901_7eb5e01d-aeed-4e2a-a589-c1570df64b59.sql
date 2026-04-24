-- 1) Backfill: insert memberships for deals with pipeline/stage but no row in deal_pipeline_stages
INSERT INTO public.deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT d.id, d.pipeline_id, d.stage_id, d.tenant_id
FROM public.deals d
WHERE d.pipeline_id IS NOT NULL
  AND d.stage_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_pipeline_stages dps
    WHERE dps.deal_id = d.id AND dps.pipeline_id = d.pipeline_id
  );

-- 2) Trigger function: keep primary pipeline membership in sync with deal
CREATE OR REPLACE FUNCTION public.sync_deal_primary_pipeline_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pipeline_id IS NULL OR NEW.stage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert membership for the primary pipeline of this deal
  INSERT INTO public.deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
  VALUES (NEW.id, NEW.pipeline_id, NEW.stage_id, NEW.tenant_id)
  ON CONFLICT (deal_id, pipeline_id) DO UPDATE
    SET stage_id = EXCLUDED.stage_id,
        updated_at = now();

  RETURN NEW;
END;
$$;

-- 3) Ensure unique constraint exists for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_pipeline_stages_deal_pipeline_unique'
  ) THEN
    ALTER TABLE public.deal_pipeline_stages
      ADD CONSTRAINT deal_pipeline_stages_deal_pipeline_unique
      UNIQUE (deal_id, pipeline_id);
  END IF;
END $$;

-- 4) Trigger on deals
DROP TRIGGER IF EXISTS trg_sync_deal_primary_pipeline_membership ON public.deals;
CREATE TRIGGER trg_sync_deal_primary_pipeline_membership
AFTER INSERT OR UPDATE OF pipeline_id, stage_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_primary_pipeline_membership();