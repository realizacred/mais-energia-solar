
-- Create helper function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- gd_groups
CREATE TABLE public.gd_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE RESTRICT,
  uc_geradora_id UUID NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gd_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gd_groups_tenant_select" ON public.gd_groups FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "gd_groups_tenant_insert" ON public.gd_groups FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "gd_groups_tenant_update" ON public.gd_groups FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "gd_groups_tenant_delete" ON public.gd_groups FOR DELETE USING (tenant_id = current_tenant_id());
CREATE INDEX idx_gd_groups_tenant ON public.gd_groups(tenant_id);
CREATE INDEX idx_gd_groups_uc_geradora ON public.gd_groups(uc_geradora_id);
CREATE INDEX idx_gd_groups_cliente ON public.gd_groups(cliente_id);

CREATE TRIGGER trg_gd_groups_updated_at BEFORE UPDATE ON public.gd_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- gd_group_beneficiaries
CREATE TABLE public.gd_group_beneficiaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  gd_group_id UUID NOT NULL REFERENCES public.gd_groups(id) ON DELETE CASCADE,
  uc_beneficiaria_id UUID NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE RESTRICT,
  allocation_type TEXT NOT NULL DEFAULT 'percentage',
  allocation_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gd_group_id, uc_beneficiaria_id)
);

ALTER TABLE public.gd_group_beneficiaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gd_ben_tenant_select" ON public.gd_group_beneficiaries FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "gd_ben_tenant_insert" ON public.gd_group_beneficiaries FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "gd_ben_tenant_update" ON public.gd_group_beneficiaries FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "gd_ben_tenant_delete" ON public.gd_group_beneficiaries FOR DELETE USING (tenant_id = current_tenant_id());
CREATE INDEX idx_gd_ben_tenant ON public.gd_group_beneficiaries(tenant_id);
CREATE INDEX idx_gd_ben_group ON public.gd_group_beneficiaries(gd_group_id);
CREATE INDEX idx_gd_ben_uc ON public.gd_group_beneficiaries(uc_beneficiaria_id);

CREATE TRIGGER trg_gd_ben_updated_at BEFORE UPDATE ON public.gd_group_beneficiaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
