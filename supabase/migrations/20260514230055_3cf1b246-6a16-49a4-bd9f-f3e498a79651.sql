-- Tabela de automações de funil
CREATE TABLE IF NOT EXISTS public.funil_automacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
    etapa_origem_id UUID REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    etapa_destino_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('documento_anexado', 'checklist_completo', 'manual')),
    condicao JSONB DEFAULT '{}'::jsonb,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de documentos obrigatórios por etapa
CREATE TABLE IF NOT EXISTS public.etapa_documentos_obrigatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pipeline_stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    label TEXT NOT NULL,
    obrigatorio BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.funil_automacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etapa_documentos_obrigatorios ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view funnel automations for their tenant"
    ON public.funil_automacoes FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage funnel automations for their tenant"
    ON public.funil_automacoes FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can view stage documents for their tenant"
    ON public.etapa_documentos_obrigatorios FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage stage documents for their tenant"
    ON public.etapa_documentos_obrigatorios FOR ALL
    USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Índices para performance
CREATE INDEX idx_funil_automacoes_pipeline ON public.funil_automacoes(pipeline_id);
CREATE INDEX idx_etapa_docs_stage ON public.etapa_documentos_obrigatorios(pipeline_stage_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_funil_automacoes_updated_at
    BEFORE UPDATE ON public.funil_automacoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tr_etapa_docs_updated_at
    BEFORE UPDATE ON public.etapa_documentos_obrigatorios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();