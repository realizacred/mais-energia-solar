
-- Enum for extraction strategy mode
CREATE TYPE public.extraction_strategy_mode AS ENUM ('native', 'provider', 'auto');

-- Enum for extraction run status
CREATE TYPE public.extraction_run_status AS ENUM ('success', 'partial', 'failed', 'needs_ocr');

-- Configuration per concessionária
CREATE TABLE public.invoice_extraction_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (public.current_tenant_id()) REFERENCES public.tenants(id) ON DELETE CASCADE,
  concessionaria_id UUID REFERENCES public.concessionarias(id) ON DELETE SET NULL,
  concessionaria_code TEXT NOT NULL,
  concessionaria_nome TEXT NOT NULL,
  strategy_mode extraction_strategy_mode NOT NULL DEFAULT 'native',
  native_enabled BOOLEAN NOT NULL DEFAULT true,
  provider_enabled BOOLEAN NOT NULL DEFAULT false,
  provider_name TEXT,
  provider_endpoint_key TEXT,
  provider_requires_base64 BOOLEAN NOT NULL DEFAULT false,
  provider_requires_password BOOLEAN NOT NULL DEFAULT false,
  fallback_enabled BOOLEAN NOT NULL DEFAULT false,
  required_fields JSONB NOT NULL DEFAULT '["consumo_kwh","valor_total"]'::jsonb,
  optional_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  parser_version TEXT DEFAULT '3.0.2',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint per tenant+concessionaria_code
CREATE UNIQUE INDEX idx_extraction_configs_tenant_code ON public.invoice_extraction_configs(tenant_id, concessionaria_code);

-- RLS
ALTER TABLE public.invoice_extraction_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select" ON public.invoice_extraction_configs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - insert" ON public.invoice_extraction_configs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - update" ON public.invoice_extraction_configs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - delete" ON public.invoice_extraction_configs
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Extraction run logs
CREATE TABLE public.invoice_extraction_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT (public.current_tenant_id()) REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.invoice_extraction_configs(id) ON DELETE SET NULL,
  invoice_id UUID,
  uc_id UUID,
  concessionaria_code TEXT NOT NULL,
  strategy_used extraction_strategy_mode NOT NULL,
  provider_used TEXT,
  parser_version TEXT,
  status extraction_run_status NOT NULL DEFAULT 'failed',
  error_reason TEXT,
  required_fields_found JSONB DEFAULT '[]'::jsonb,
  required_fields_missing JSONB DEFAULT '[]'::jsonb,
  response_excerpt JSONB,
  confidence_score NUMERIC(5,2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extraction_runs_tenant ON public.invoice_extraction_runs(tenant_id);
CREATE INDEX idx_extraction_runs_config ON public.invoice_extraction_runs(config_id);

ALTER TABLE public.invoice_extraction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select" ON public.invoice_extraction_runs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant isolation - insert" ON public.invoice_extraction_runs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
