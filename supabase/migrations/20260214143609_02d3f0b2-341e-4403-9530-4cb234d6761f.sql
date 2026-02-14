
-- ═══════════════════════════════════════════════════════════
-- FASE 3: Catálogo unificado, variáveis customizadas, templates
-- ═══════════════════════════════════════════════════════════

-- 1) Tabela de variáveis customizadas por tenant (vc_*)
CREATE TABLE public.proposta_variaveis_custom (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,                         -- ex: "vc_roi_percentual"
  label TEXT NOT NULL,                        -- ex: "ROI (%)"
  expressao TEXT NOT NULL,                    -- ex: "[economia_anual]/[valor_total]*100"
  tipo_resultado TEXT NOT NULL DEFAULT 'number', -- number | text | currency | percent
  categoria TEXT NOT NULL DEFAULT 'geral',    -- geral | financeiro | tecnico | comercial
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, nome)
);

ALTER TABLE public.proposta_variaveis_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.proposta_variaveis_custom
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.proposta_variaveis_custom
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.proposta_variaveis_custom
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.proposta_variaveis_custom
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE INDEX idx_proposta_vc_tenant ON public.proposta_variaveis_custom(tenant_id, ativo);

CREATE TRIGGER update_proposta_vc_updated_at
  BEFORE UPDATE ON public.proposta_variaveis_custom
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) Adicionar campos faltantes em proposta_templates
ALTER TABLE public.proposta_templates
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS ordem INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'html'; -- html | pdf | docx

CREATE INDEX IF NOT EXISTS idx_proposta_templates_tenant_ativo
  ON public.proposta_templates(tenant_id, ativo, ordem);

-- 3) Tabela de snapshot de variáveis custom por versão
CREATE TABLE public.proposta_versao_variaveis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  versao_id UUID NOT NULL REFERENCES public.proposta_versoes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  variavel_id UUID REFERENCES public.proposta_variaveis_custom(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  label TEXT NOT NULL,
  expressao TEXT NOT NULL,
  valor_calculado TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.proposta_versao_variaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.proposta_versao_variaveis
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.proposta_versao_variaveis
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id());

CREATE INDEX idx_versao_variaveis_versao ON public.proposta_versao_variaveis(versao_id);
