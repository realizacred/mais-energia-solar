
-- Tabela de configuração de loading por tenant (1 registro por tenant)
CREATE TABLE public.loading_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Loader do Sol
  sun_loader_enabled BOOLEAN NOT NULL DEFAULT true,
  sun_loader_style TEXT NOT NULL DEFAULT 'pulse' CHECK (sun_loader_style IN ('pulse', 'spin', 'breathe')),
  
  -- Mensagens
  show_messages BOOLEAN NOT NULL DEFAULT true,
  
  -- Overlay
  overlay_delay_ms INTEGER NOT NULL DEFAULT 400 CHECK (overlay_delay_ms BETWEEN 100 AND 3000),
  overlay_min_duration_ms INTEGER NOT NULL DEFAULT 300 CHECK (overlay_min_duration_ms BETWEEN 100 AND 5000),
  
  -- Catálogo de mensagens por contexto (jsonb)
  messages_catalog JSONB NOT NULL DEFAULT '{
    "general": ["Carregando..."],
    "submit": ["Enviando dados...", "Processando..."],
    "data_load": ["Carregando dados...", "Buscando informações..."],
    "upload": ["Enviando arquivo...", "Processando upload..."],
    "whatsapp": ["Enviando mensagem...", "Conectando..."],
    "ai_analysis": ["Analisando dados...", "Processando análise..."],
    "calculation": ["Calculando economia...", "Simulando cenários..."],
    "login": ["Verificando credenciais...", "Autenticando..."]
  }'::jsonb,
  
  -- IA opcional
  ai_messages_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_min_duration_seconds INTEGER NOT NULL DEFAULT 3 CHECK (ai_min_duration_seconds BETWEEN 1 AND 30),
  ai_timeout_ms INTEGER NOT NULL DEFAULT 2000 CHECK (ai_timeout_ms BETWEEN 500 AND 10000),
  ai_max_calls_per_flow INTEGER NOT NULL DEFAULT 1 CHECK (ai_max_calls_per_flow BETWEEN 1 AND 5),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT loading_config_tenant_unique UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE public.loading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view loading config"
  ON public.loading_config FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can update loading config"
  ON public.loading_config FOR UPDATE
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can insert loading config"
  ON public.loading_config FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_loading_config_updated_at
  BEFORE UPDATE ON public.loading_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_loading_config
  AFTER INSERT OR UPDATE OR DELETE ON public.loading_config
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- Index
CREATE INDEX idx_loading_config_tenant ON public.loading_config(tenant_id);
