-- Create sm_funil_pipeline_map
CREATE TABLE IF NOT EXISTS public.sm_funil_pipeline_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT get_user_tenant_id(),
  sm_funil_name text NOT NULL,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_funil_name)
);

CREATE INDEX IF NOT EXISTS idx_sm_funil_map_tenant ON public.sm_funil_pipeline_map(tenant_id);

ALTER TABLE public.sm_funil_pipeline_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_funil_map_select" ON public.sm_funil_pipeline_map
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_funil_map_insert" ON public.sm_funil_pipeline_map
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_funil_map_update" ON public.sm_funil_pipeline_map
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_funil_map_delete" ON public.sm_funil_pipeline_map
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

-- Create sm_etapa_stage_map
CREATE TABLE IF NOT EXISTS public.sm_etapa_stage_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE DEFAULT get_user_tenant_id(),
  sm_funil_name text NOT NULL,
  sm_etapa_name text NOT NULL,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_funil_name, sm_etapa_name)
);

CREATE INDEX IF NOT EXISTS idx_sm_etapa_map_tenant ON public.sm_etapa_stage_map(tenant_id);

ALTER TABLE public.sm_etapa_stage_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_etapa_map_select" ON public.sm_etapa_stage_map
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_etapa_map_insert" ON public.sm_etapa_stage_map
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_etapa_map_update" ON public.sm_etapa_stage_map
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "sm_etapa_map_delete" ON public.sm_etapa_stage_map
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());