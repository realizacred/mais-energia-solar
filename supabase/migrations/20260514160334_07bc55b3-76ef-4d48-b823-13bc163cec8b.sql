-- Índices para otimizar queries do Kanban de Projetos
CREATE INDEX IF NOT EXISTS idx_projetos_tenant_id ON public.projetos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projetos_deal_id ON public.projetos(deal_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON public.projetos(status);
CREATE INDEX IF NOT EXISTS idx_projetos_funil_id ON public.projetos(funil_id);
CREATE INDEX IF NOT EXISTS idx_projetos_etapa_id ON public.projetos(etapa_id);

-- Índices para otimizar multi-pipeline membership
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_stages_deal_id ON public.deal_pipeline_stages(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_stages_stage_id ON public.deal_pipeline_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_deal_pipeline_stages_pipeline_id ON public.deal_pipeline_stages(pipeline_id);

-- Índice para busca por código
CREATE INDEX IF NOT EXISTS idx_projetos_codigo_trgm ON public.projetos USING gin (codigo gin_trgm_ops);
