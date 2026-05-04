-- Tabela de fila persistente para enriquecimento via IA em background
CREATE TABLE IF NOT EXISTS public.equipment_enrichment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  created_by UUID NOT NULL,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('modulo','inversor','otimizador','bateria')),
  equipment_ids UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','cancelled','failed')),
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  dual_count INTEGER NOT NULL DEFAULT 0,
  last_model TEXT,
  last_processed_index INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eej_status_heartbeat ON public.equipment_enrichment_jobs (status, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_eej_tenant_created ON public.equipment_enrichment_jobs (tenant_id, created_at DESC);

ALTER TABLE public.equipment_enrichment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own enrichment jobs"
ON public.equipment_enrichment_jobs FOR SELECT
USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant users can create enrichment jobs"
ON public.equipment_enrichment_jobs FOR INSERT
WITH CHECK (
  tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid
  AND created_by = auth.uid()
);

CREATE POLICY "Tenant users can cancel own enrichment jobs"
ON public.equipment_enrichment_jobs FOR UPDATE
USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE TRIGGER trg_eej_updated_at
BEFORE UPDATE ON public.equipment_enrichment_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();