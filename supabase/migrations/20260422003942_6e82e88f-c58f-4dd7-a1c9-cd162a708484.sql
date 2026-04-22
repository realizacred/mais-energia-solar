-- Tabela de mapeamento SM → Consultor nativo (substitui VENDEDOR_MAP hardcoded)
CREATE TABLE IF NOT EXISTS public.sm_consultor_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT get_user_tenant_id(),
  sm_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  consultor_id UUID REFERENCES public.consultores(id) ON DELETE SET NULL,
  is_ex_funcionario BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sm_name)
);

ALTER TABLE public.sm_consultor_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_select" ON public.sm_consultor_mapping;
CREATE POLICY "tenant_isolation_select" ON public.sm_consultor_mapping
  FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.sm_consultor_mapping;
CREATE POLICY "tenant_isolation_insert" ON public.sm_consultor_mapping
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON public.sm_consultor_mapping;
CREATE POLICY "tenant_isolation_update" ON public.sm_consultor_mapping
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.sm_consultor_mapping;
CREATE POLICY "tenant_isolation_delete" ON public.sm_consultor_mapping
  FOR DELETE USING (tenant_id = get_user_tenant_id());

CREATE INDEX IF NOT EXISTS idx_sm_consultor_mapping_tenant_sm ON public.sm_consultor_mapping (tenant_id, sm_name);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_sm_consultor_mapping_updated_at ON public.sm_consultor_mapping;
CREATE TRIGGER trg_sm_consultor_mapping_updated_at
  BEFORE UPDATE ON public.sm_consultor_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mapeamento: Bruno Caetano (SM) → BRUNO BANDEIRA (nativo)
INSERT INTO public.sm_consultor_mapping (tenant_id, sm_name, canonical_name, consultor_id, is_ex_funcionario)
VALUES (
  '17de8315-2e2f-4a79-8751-e5d507d69a41',
  'Bruno Caetano',
  'BRUNO BANDEIRA',
  'c0ecc5e7-0efd-41d7-a25e-e3aff106ab67',
  false
)
ON CONFLICT (tenant_id, sm_name) DO UPDATE
  SET consultor_id = EXCLUDED.consultor_id,
      canonical_name = EXCLUDED.canonical_name,
      is_ex_funcionario = EXCLUDED.is_ex_funcionario,
      updated_at = now();