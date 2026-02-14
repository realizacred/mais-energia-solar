
-- ============================================================
-- MÓDULO PROJETOS: Pipeline dinâmico com funis, etapas e etiquetas
-- ============================================================

-- 1) Tabela de Funis (pipelines dinâmicos por tenant)
CREATE TABLE public.projeto_funis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_funis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_funis_select" ON public.projeto_funis
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_funis_insert" ON public.projeto_funis
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_funis_update" ON public.projeto_funis
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_funis_delete" ON public.projeto_funis
  FOR DELETE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

CREATE TRIGGER update_projeto_funis_updated_at
  BEFORE UPDATE ON public.projeto_funis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Tabela de Etapas (colunas do kanban, vinculadas ao funil)
CREATE TYPE public.projeto_etapa_categoria AS ENUM ('aberto', 'ganho', 'perdido', 'excluido');

CREATE TABLE public.projeto_etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funil_id UUID NOT NULL REFERENCES projeto_funis(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#6B7280',
  ordem INTEGER NOT NULL DEFAULT 0,
  categoria public.projeto_etapa_categoria NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_etapas_select" ON public.projeto_etapas
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etapas_insert" ON public.projeto_etapas
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etapas_update" ON public.projeto_etapas
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etapas_delete" ON public.projeto_etapas
  FOR DELETE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

CREATE TRIGGER update_projeto_etapas_updated_at
  BEFORE UPDATE ON public.projeto_etapas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) Tabela de Etiquetas (tags coloridas por tenant)
CREATE TABLE public.projeto_etiquetas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projeto_etiquetas_select" ON public.projeto_etiquetas
  FOR SELECT USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etiquetas_insert" ON public.projeto_etiquetas
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etiquetas_update" ON public.projeto_etiquetas
  FOR UPDATE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "projeto_etiquetas_delete" ON public.projeto_etiquetas
  FOR DELETE USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());

-- 4) Tabela de relação M:N projeto <-> etiquetas
CREATE TABLE public.projeto_etiqueta_rel (
  projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  etiqueta_id UUID NOT NULL REFERENCES projeto_etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (projeto_id, etiqueta_id)
);

ALTER TABLE public.projeto_etiqueta_rel ENABLE ROW LEVEL SECURITY;

-- RLS via join com projetos (tenant isolation)
CREATE POLICY "projeto_etiqueta_rel_select" ON public.projeto_etiqueta_rel
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND p.tenant_id = get_user_tenant_id())
  );
CREATE POLICY "projeto_etiqueta_rel_insert" ON public.projeto_etiqueta_rel
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND p.tenant_id = get_user_tenant_id())
  );
CREATE POLICY "projeto_etiqueta_rel_delete" ON public.projeto_etiqueta_rel
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projetos p WHERE p.id = projeto_id AND p.tenant_id = get_user_tenant_id())
  );

-- 5) Alterar tabela projetos: adicionar funil_id, etapa_id, e vincular propostas
ALTER TABLE public.projetos
  ADD COLUMN funil_id UUID REFERENCES projeto_funis(id),
  ADD COLUMN etapa_id UUID REFERENCES projeto_etapas(id),
  ADD COLUMN proposta_id UUID REFERENCES propostas_nativas(id);

-- Índices para performance
CREATE INDEX idx_projeto_funis_tenant ON public.projeto_funis(tenant_id);
CREATE INDEX idx_projeto_etapas_funil ON public.projeto_etapas(funil_id);
CREATE INDEX idx_projeto_etapas_tenant ON public.projeto_etapas(tenant_id);
CREATE INDEX idx_projeto_etiquetas_tenant ON public.projeto_etiquetas(tenant_id);
CREATE INDEX idx_projetos_funil ON public.projetos(funil_id);
CREATE INDEX idx_projetos_etapa ON public.projetos(etapa_id);
CREATE INDEX idx_projetos_proposta ON public.projetos(proposta_id) WHERE proposta_id IS NOT NULL;
