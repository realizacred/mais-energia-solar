
-- =====================================================
-- Edeltec Integration: Sync State + Logs + Catalog enrichment
-- =====================================================

-- 1. Sync state table for checkpoint-based batch processing
CREATE TABLE IF NOT EXISTS public.integration_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'edeltec',
  mode TEXT NOT NULL DEFAULT 'incremental' CHECK (mode IN ('incremental', 'full_replace')),
  current_page INT NOT NULL DEFAULT 0,
  total_pages INT,
  batch_size INT NOT NULL DEFAULT 5,
  processed_items INT NOT NULL DEFAULT 0,
  inserted_items INT NOT NULL DEFAULT 0,
  updated_items INT NOT NULL DEFAULT 0,
  ignored_items INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error')),
  started_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique: one state per tenant+provider
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_state_tenant_provider
  ON public.integration_sync_state(tenant_id, provider);

ALTER TABLE public.integration_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation SELECT" ON public.integration_sync_state
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation INSERT" ON public.integration_sync_state
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation UPDATE" ON public.integration_sync_state
  FOR UPDATE USING (tenant_id = public.get_user_tenant_id());

CREATE TRIGGER update_integration_sync_state_updated_at
  BEFORE UPDATE ON public.integration_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Sync logs table
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'edeltec',
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_tenant_provider
  ON public.integration_sync_logs(tenant_id, provider, created_at DESC);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation SELECT" ON public.integration_sync_logs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id());
CREATE POLICY "Tenant isolation INSERT" ON public.integration_sync_logs
  FOR INSERT WITH CHECK (tenant_id = public.get_user_tenant_id());

-- 3. Add enrichment columns to solar_kit_catalog for Edeltec data
ALTER TABLE public.solar_kit_catalog
  ADD COLUMN IF NOT EXISTS fabricante TEXT,
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS potencia_inversor NUMERIC,
  ADD COLUMN IF NOT EXISTS potencia_modulo NUMERIC,
  ADD COLUMN IF NOT EXISTS fase TEXT,
  ADD COLUMN IF NOT EXISTS tensao TEXT,
  ADD COLUMN IF NOT EXISTS estrutura TEXT,
  ADD COLUMN IF NOT EXISTS preco_consumidor NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_avulso NUMERIC,
  ADD COLUMN IF NOT EXISTS disponivel BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_compra_sem_estoque BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS previsao TEXT,
  ADD COLUMN IF NOT EXISTS product_kind TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_generator BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_available_now BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS preco_por_kwp NUMERIC,
  ADD COLUMN IF NOT EXISTS external_code TEXT,
  ADD COLUMN IF NOT EXISTS imagem_principal_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Index for generator filtering
CREATE INDEX IF NOT EXISTS idx_kit_catalog_generator
  ON public.solar_kit_catalog(tenant_id, is_generator, status)
  WHERE is_generator = true;

-- Unique constraint for external sync (prevent duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_kit_catalog_tenant_source_extid
  ON public.solar_kit_catalog(tenant_id, source, external_id)
  WHERE external_id IS NOT NULL;
