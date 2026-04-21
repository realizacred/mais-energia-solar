-- Tabela canônica de arquivos importados
CREATE TABLE IF NOT EXISTS public.imported_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_system TEXT NOT NULL,
  source_url TEXT,
  source_record_id TEXT,
  original_file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  file_hash TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','error')),
  error_message TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único de deduplicação por tenant+hash (apenas quando status=success)
CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_files_tenant_hash
  ON public.imported_files (tenant_id, file_hash)
  WHERE file_hash IS NOT NULL AND status = 'success';

CREATE INDEX IF NOT EXISTS idx_imported_files_tenant ON public.imported_files(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imported_files_source ON public.imported_files(source_system, source_url);
CREATE INDEX IF NOT EXISTS idx_imported_files_status ON public.imported_files(status);

ALTER TABLE public.imported_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view imported files"
  ON public.imported_files FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant admins can delete imported files"
  ON public.imported_files FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_role(auth.uid(), 'admin'));

-- Tabela de vínculo entidade ↔ arquivo
CREATE TABLE IF NOT EXISTS public.entity_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_id UUID NOT NULL REFERENCES public.imported_files(id) ON DELETE CASCADE,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id, file_id, category)
);

CREATE INDEX IF NOT EXISTS idx_entity_files_entity ON public.entity_files(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_files_file ON public.entity_files(file_id);

ALTER TABLE public.entity_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view entity files"
  ON public.entity_files FOR SELECT
  USING (tenant_id = public.get_user_tenant_id());

CREATE POLICY "Tenant admins can delete entity files"
  ON public.entity_files FOR DELETE
  USING (tenant_id = public.get_user_tenant_id() AND public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_imported_files_updated_at
  BEFORE UPDATE ON public.imported_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para arquivos importados
INSERT INTO storage.buckets (id, name, public)
VALUES ('imported-files', 'imported-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: apenas leitura autenticada pelo tenant (primeiro segmento do path = tenant_id)
CREATE POLICY "Authenticated users can read imported files from their tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'imported-files'
    AND (storage.foldername(name))[1] = public.get_user_tenant_id()::text
  );