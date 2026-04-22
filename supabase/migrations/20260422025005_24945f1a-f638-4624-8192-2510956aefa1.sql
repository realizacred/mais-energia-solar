CREATE TABLE public.sm_projeto_funis_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sm_project_id bigint NOT NULL,
  sm_funnel_id bigint NOT NULL,
  sm_stage_id bigint,
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  import_job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_project_id, sm_funnel_id)
);

CREATE INDEX idx_sm_pf_tenant ON public.sm_projeto_funis_raw(tenant_id);
CREATE INDEX idx_sm_pf_project ON public.sm_projeto_funis_raw(sm_project_id);
CREATE INDEX idx_sm_pf_funnel ON public.sm_projeto_funis_raw(sm_funnel_id);

ALTER TABLE public.sm_projeto_funis_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rls_sm_projeto_funis_select"
  ON public.sm_projeto_funis_raw
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "rls_sm_projeto_funis_all"
  ON public.sm_projeto_funis_raw
  FOR ALL
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

COMMENT ON TABLE public.sm_projeto_funis_raw IS
  'Vínculo projeto-funil-etapa do SolarMarket (via GET /projects/:id/funnels)';