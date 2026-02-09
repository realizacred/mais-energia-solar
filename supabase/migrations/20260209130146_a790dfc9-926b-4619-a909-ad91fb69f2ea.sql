
-- Tabela de auditoria para migração de storage
CREATE TABLE public.storage_migration_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bucket TEXT NOT NULL,
  old_path TEXT NOT NULL,
  new_path TEXT,
  tabela TEXT,
  registro_id UUID,
  campo TEXT,
  tenant_id UUID,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, copied, verified, updated, failed, orphan
  error TEXT,
  migrated_at TIMESTAMPTZ DEFAULT now()
);

-- Não precisa de RLS — tabela administrativa usada apenas via service_role
ALTER TABLE public.storage_migration_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler
CREATE POLICY "rls_storage_migration_log_select_admin"
ON public.storage_migration_log FOR SELECT TO authenticated
USING (is_admin(auth.uid()));
