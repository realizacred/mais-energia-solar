
-- ══════════════════════════════════════════════════════════════
-- Tabela de configuração central de provedor de IA (por tenant)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.ai_provider_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  active_provider TEXT NOT NULL DEFAULT 'lovable_gateway',
  active_model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  fallback_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_ai_provider_config_tenant ON public.ai_provider_config(tenant_id);

ALTER TABLE public.ai_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_provider_config_select"
  ON public.ai_provider_config FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "ai_provider_config_insert"
  ON public.ai_provider_config FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "ai_provider_config_update"
  ON public.ai_provider_config FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ══════════════════════════════════════════════════════════════
-- Tabela de logs de consumo de IA (por tenant)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  function_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_logs_tenant ON public.ai_usage_logs(tenant_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);
CREATE INDEX idx_ai_usage_logs_tenant_created ON public.ai_usage_logs(tenant_id, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_logs_select"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "ai_usage_logs_insert"
  ON public.ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (true);
