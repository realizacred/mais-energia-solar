
-- ═══════════════════════════════════════════════════════════
-- Gap 2: Tabela de logs por request da API SolarMarket
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.solar_market_integration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  request_id TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  params JSONB DEFAULT '{}'::jsonb,
  status_code INTEGER,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas recentes e limpeza
CREATE INDEX idx_sm_integ_requests_tenant_created 
  ON public.solar_market_integration_requests(tenant_id, created_at DESC);

CREATE INDEX idx_sm_integ_requests_status 
  ON public.solar_market_integration_requests(status_code) 
  WHERE status_code >= 400;

-- RLS
ALTER TABLE public.solar_market_integration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view integration requests"
  ON public.solar_market_integration_requests FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert integration requests"
  ON public.solar_market_integration_requests FOR INSERT
  WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.solar_market_integration_requests IS 'Log de cada requisição HTTP feita à API SolarMarket para auditoria e debug';

-- ═══════════════════════════════════════════════════════════
-- Gap 6: Tabela de itens com falha na sincronização
-- ═══════════════════════════════════════════════════════════
CREATE TABLE public.solar_market_sync_items_failed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  sync_log_id UUID REFERENCES public.solar_market_sync_logs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'client', 'project', 'proposal', 'custom_field', 'funnel', 'user'
  entity_id TEXT, -- SM external ID
  error_message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sm_sync_items_failed_log 
  ON public.solar_market_sync_items_failed(sync_log_id);

-- RLS
ALTER TABLE public.solar_market_sync_items_failed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync items failed"
  ON public.solar_market_sync_items_failed FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert sync items failed"
  ON public.solar_market_sync_items_failed FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.solar_market_sync_items_failed IS 'Registra cada item que falhou durante uma sincronização com SolarMarket';

-- ═══════════════════════════════════════════════════════════
-- Gap 5: Garantir tenant_id preenchido na config
-- ═══════════════════════════════════════════════════════════
UPDATE public.solar_market_config 
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- Política de retenção automática para integration_requests (30 dias)
-- Usamos uma function que pode ser chamada via cron
CREATE OR REPLACE FUNCTION public.cleanup_sm_integration_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM solar_market_integration_requests
  WHERE created_at < now() - interval '30 days';
END;
$$;

COMMENT ON FUNCTION public.cleanup_sm_integration_requests IS 'Remove logs de requests SM com mais de 30 dias';
