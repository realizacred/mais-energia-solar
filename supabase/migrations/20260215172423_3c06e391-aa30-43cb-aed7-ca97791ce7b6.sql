
-- Stage permissions: restrict who can move cards in certain stages
CREATE TABLE public.pipeline_stage_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  restricao_tipo TEXT NOT NULL DEFAULT 'todos' CHECK (restricao_tipo IN ('todos', 'apenas_responsavel', 'apenas_roles')),
  roles_permitidos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stage_id, tenant_id)
);

ALTER TABLE public.pipeline_stage_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stage permissions"
  ON public.pipeline_stage_permissions FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage stage permissions"
  ON public.pipeline_stage_permissions FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

CREATE TRIGGER update_pipeline_stage_permissions_updated_at
  BEFORE UPDATE ON public.pipeline_stage_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_stage_permissions_stage ON public.pipeline_stage_permissions(stage_id);

-- Trigger to auto-set tenant_id from stage
CREATE OR REPLACE FUNCTION public.resolve_stage_permission_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT ps.tenant_id INTO NEW.tenant_id FROM pipeline_stages ps WHERE ps.id = NEW.stage_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_stage_permission_tenant
  BEFORE INSERT ON public.pipeline_stage_permissions
  FOR EACH ROW EXECUTE FUNCTION public.resolve_stage_permission_tenant();
