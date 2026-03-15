
-- ============================================================
-- Backup & Restore module — backup_logs table + storage bucket
-- ============================================================

-- 1. Create backup_logs table
CREATE TABLE public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  backup_type TEXT NOT NULL DEFAULT 'full' CHECK (backup_type IN ('full', 'partial')),
  file_path TEXT,
  file_size_bytes BIGINT,
  tables_included TEXT[] NOT NULL DEFAULT '{}',
  tables_row_counts JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

-- 2. Indexes
CREATE INDEX idx_backup_logs_tenant_id ON public.backup_logs(tenant_id);
CREATE INDEX idx_backup_logs_status ON public.backup_logs(tenant_id, status);
CREATE INDEX idx_backup_logs_created_at ON public.backup_logs(tenant_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — admin only via has_role
CREATE POLICY "backup_logs_select_admin"
  ON public.backup_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "backup_logs_insert_admin"
  ON public.backup_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "backup_logs_update_admin"
  ON public.backup_logs
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.has_role(auth.uid(), 'admin')
  );

-- 5. Private storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-backups', 'tenant-backups', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS — only admins of the tenant can access their backups
CREATE POLICY "tenant_backups_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tenant-backups'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "tenant_backups_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-backups'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "tenant_backups_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-backups'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.has_role(auth.uid(), 'admin')
  );
