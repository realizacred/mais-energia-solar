
-- Junction table: deal can exist in multiple pipelines with independent stages
CREATE TABLE public.deal_pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, pipeline_id)
);

-- Indexes
CREATE INDEX idx_deal_pipeline_stages_deal ON public.deal_pipeline_stages(deal_id);
CREATE INDEX idx_deal_pipeline_stages_pipeline ON public.deal_pipeline_stages(pipeline_id, stage_id);
CREATE INDEX idx_deal_pipeline_stages_tenant ON public.deal_pipeline_stages(tenant_id);

-- RLS
ALTER TABLE public.deal_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for deal_pipeline_stages"
  ON public.deal_pipeline_stages
  FOR ALL
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Auto-resolve tenant_id from deal
CREATE OR REPLACE FUNCTION public.resolve_deal_pipeline_stages_tenant()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM deals WHERE id = NEW.deal_id;
  END IF;
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'deal_pipeline_stages: cannot resolve tenant_id' USING ERRCODE = 'P0402';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_deal_pipeline_stages_tenant
  BEFORE INSERT ON public.deal_pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_deal_pipeline_stages_tenant();

-- Auto-update updated_at
CREATE TRIGGER update_deal_pipeline_stages_updated_at
  BEFORE UPDATE ON public.deal_pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing deals into the junction table (backward compat)
INSERT INTO public.deal_pipeline_stages (deal_id, pipeline_id, stage_id, tenant_id)
SELECT d.id, d.pipeline_id, d.stage_id, d.tenant_id
FROM public.deals d
WHERE d.pipeline_id IS NOT NULL AND d.stage_id IS NOT NULL
ON CONFLICT DO NOTHING;
