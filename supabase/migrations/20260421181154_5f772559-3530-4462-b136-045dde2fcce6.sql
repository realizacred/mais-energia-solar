-- =============================================================================
-- PR 1 — Fase 2 SolarMarket: infraestrutura mínima de promoção staging → CRM
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) external_entity_links — SSOT de rastreio canônico ↔ origem externa
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.external_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,

  source TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,

  promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promotion_job_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT external_entity_links_entity_type_check
    CHECK (entity_type IN ('cliente','projeto','proposta','proposta_versao')),
  CONSTRAINT external_entity_links_source_check
    CHECK (source IN ('solarmarket'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_eel_source
  ON public.external_entity_links (tenant_id, source, source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_eel_entity
  ON public.external_entity_links (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_eel_tenant
  ON public.external_entity_links (tenant_id);

CREATE INDEX IF NOT EXISTS idx_eel_promotion_job
  ON public.external_entity_links (promotion_job_id)
  WHERE promotion_job_id IS NOT NULL;

ALTER TABLE public.external_entity_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eel_select_tenant"
  ON public.external_entity_links FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "eel_insert_tenant"
  ON public.external_entity_links FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "eel_update_tenant"
  ON public.external_entity_links FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "eel_delete_admin"
  ON public.external_entity_links FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_admin(auth.uid()));

CREATE TRIGGER trg_eel_updated_at
  BEFORE UPDATE ON public.external_entity_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) solarmarket_promotion_jobs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solarmarket_promotion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',

  target_entity_type TEXT,
  target_entity_ids TEXT[],
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,

  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  triggered_by UUID,
  trigger_source TEXT NOT NULL DEFAULT 'manual',

  total_items INTEGER NOT NULL DEFAULT 0,
  items_processed INTEGER NOT NULL DEFAULT 0,
  items_promoted INTEGER NOT NULL DEFAULT 0,
  items_skipped INTEGER NOT NULL DEFAULT 0,
  items_with_warnings INTEGER NOT NULL DEFAULT 0,
  items_with_errors INTEGER NOT NULL DEFAULT 0,

  error_summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT spj_status_check
    CHECK (status IN ('pending','running','completed','completed_with_warnings','failed','cancelled')),
  CONSTRAINT spj_job_type_check
    CHECK (job_type IN ('promote-all','promote-job','promote-single')),
  CONSTRAINT spj_trigger_source_check
    CHECK (trigger_source IN ('manual','cron','api'))
);

CREATE INDEX IF NOT EXISTS idx_spj_tenant_status
  ON public.solarmarket_promotion_jobs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spj_tenant_created
  ON public.solarmarket_promotion_jobs (tenant_id, created_at DESC);

ALTER TABLE public.solarmarket_promotion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spj_select_tenant"
  ON public.solarmarket_promotion_jobs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "spj_insert_tenant"
  ON public.solarmarket_promotion_jobs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "spj_update_tenant"
  ON public.solarmarket_promotion_jobs FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "spj_delete_admin"
  ON public.solarmarket_promotion_jobs FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_admin(auth.uid()));

CREATE TRIGGER trg_spj_updated_at
  BEFORE UPDATE ON public.solarmarket_promotion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) solarmarket_promotion_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.solarmarket_promotion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.solarmarket_promotion_jobs(id) ON DELETE CASCADE,

  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,

  step TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',

  error_code TEXT,
  error_origin TEXT,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  canonical_entity_type TEXT,
  canonical_entity_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT spl_status_check
    CHECK (status IN ('ok','skipped','warning','error')),
  CONSTRAINT spl_severity_check
    CHECK (severity IN ('info','warning','error'))
);

CREATE INDEX IF NOT EXISTS idx_spl_job
  ON public.solarmarket_promotion_logs (job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_spl_tenant_severity
  ON public.solarmarket_promotion_logs (tenant_id, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spl_source_entity
  ON public.solarmarket_promotion_logs (tenant_id, source_entity_type, source_entity_id);

ALTER TABLE public.solarmarket_promotion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spl_select_tenant"
  ON public.solarmarket_promotion_logs FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "spl_insert_tenant"
  ON public.solarmarket_promotion_logs FOR INSERT
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "spl_delete_admin"
  ON public.solarmarket_promotion_logs FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.is_admin(auth.uid()));
