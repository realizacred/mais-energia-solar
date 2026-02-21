
-- ═══ Fase 3: Versionamento de Tarifas ═══

-- 1. Tabela de versões
CREATE TABLE public.tarifa_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('sync', 'manual', 'import')),
  notas TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativa', 'arquivada')),
  total_registros INTEGER DEFAULT 0,
  total_concessionarias INTEGER DEFAULT 0,
  arquivo_nome TEXT,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id)
);

-- 2. Adicionar versao_id na tabela de tarifas
ALTER TABLE public.concessionaria_tarifas_subgrupo
  ADD COLUMN versao_id UUID REFERENCES public.tarifa_versoes(id);

-- 3. RLS para tarifa_versoes
ALTER TABLE public.tarifa_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select"
  ON public.tarifa_versoes FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - insert"
  ON public.tarifa_versoes FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - update"
  ON public.tarifa_versoes FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - delete"
  ON public.tarifa_versoes FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Índices
CREATE INDEX idx_tarifa_versoes_tenant ON public.tarifa_versoes(tenant_id);
CREATE INDEX idx_tarifa_versoes_status ON public.tarifa_versoes(tenant_id, status);
CREATE INDEX idx_tarifas_subgrupo_versao ON public.concessionaria_tarifas_subgrupo(versao_id);
