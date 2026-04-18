-- ============================================================
-- FASE 1: Reescrita do sistema de migração SolarMarket
-- ============================================================

-- 1) Backup da tabela antiga (rename, não delete)
ALTER TABLE IF EXISTS public.sm_project_classification 
  RENAME TO sm_project_classification_OLD_BACKUP;

COMMENT ON TABLE public.sm_project_classification_OLD_BACKUP IS 
  'DEPRECATED - Backup de sm_project_classification. Substituída por sm_classification_v2. Deletar após validação completa do novo sistema.';

-- 2) Tabela: migration_jobs
CREATE TABLE public.migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'sync_from_sm', 'classify_projects', 'resolve_funnels',
    'migrate_clients', 'migrate_projects', 'migrate_proposals', 'full_migration'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'rolled_back'
  )),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_jobs_tenant_status ON public.migration_jobs(tenant_id, status);
CREATE INDEX idx_migration_jobs_created ON public.migration_jobs(created_at DESC);

ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_migration_jobs"
  ON public.migration_jobs FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_insert_migration_jobs"
  ON public.migration_jobs FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_update_migration_jobs"
  ON public.migration_jobs FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_delete_migration_jobs"
  ON public.migration_jobs FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- 3) Tabela: migration_records
CREATE TABLE public.migration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'project', 'proposal')),
  sm_entity_id bigint NOT NULL,
  native_entity_id uuid,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'migrated', 'skipped', 'failed')),
  source_data jsonb,
  error_message text,
  validation_errors jsonb,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, entity_type, sm_entity_id)
);

CREATE INDEX idx_migration_records_job ON public.migration_records(job_id, status);
CREATE INDEX idx_migration_records_entity ON public.migration_records(entity_type, sm_entity_id);
CREATE INDEX idx_migration_records_tenant ON public.migration_records(tenant_id);

ALTER TABLE public.migration_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_migration_records"
  ON public.migration_records FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_insert_migration_records"
  ON public.migration_records FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_update_migration_records"
  ON public.migration_records FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_delete_migration_records"
  ON public.migration_records FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- 4) Tabela: sm_classification_v2
CREATE TABLE public.sm_classification_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sm_project_id bigint NOT NULL,
  category text NOT NULL CHECK (category IN (
    'comercial', 'engenharia', 'equipamento', 'compensacao', 'verificar_dados'
  )),
  target_funil_id uuid REFERENCES public.projeto_funis(id) ON DELETE SET NULL,
  target_etapa_id uuid REFERENCES public.projeto_etapas(id) ON DELETE SET NULL,
  confidence_score numeric(3,2),
  classification_reason text,
  override_by uuid REFERENCES auth.users(id),
  override_reason text,
  classified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sm_project_id)
);

CREATE INDEX idx_classification_v2_tenant ON public.sm_classification_v2(tenant_id);
CREATE INDEX idx_classification_v2_category ON public.sm_classification_v2(tenant_id, category);
CREATE INDEX idx_classification_v2_resolved ON public.sm_classification_v2(tenant_id) WHERE target_funil_id IS NOT NULL AND target_etapa_id IS NOT NULL;

ALTER TABLE public.sm_classification_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_sm_classification_v2"
  ON public.sm_classification_v2 FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_insert_sm_classification_v2"
  ON public.sm_classification_v2 FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_update_sm_classification_v2"
  ON public.sm_classification_v2 FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE POLICY "tenant_delete_sm_classification_v2"
  ON public.sm_classification_v2 FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
CREATE TRIGGER trg_sm_classification_v2_updated_at
  BEFORE UPDATE ON public.sm_classification_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();