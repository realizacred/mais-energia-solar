-- Catálogo de features de energia que podem ser controladas por plano
CREATE TABLE IF NOT EXISTS public.plano_servico_features (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id    uuid NOT NULL REFERENCES public.planos_servico(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  tenant_id   uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plano_id, feature_key)
);

ALTER TABLE public.plano_servico_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_plano_features_select" ON public.plano_servico_features FOR SELECT
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_plano_features_insert" ON public.plano_servico_features FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_plano_features_update" ON public.plano_servico_features FOR UPDATE
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_plano_features_delete" ON public.plano_servico_features FOR DELETE
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_plano_features_plano ON public.plano_servico_features(plano_id);
CREATE INDEX IF NOT EXISTS idx_plano_features_tenant ON public.plano_servico_features(tenant_id);