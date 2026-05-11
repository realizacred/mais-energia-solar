
-- ============================================================
-- FASE 1: Foundation canônica — project_documents + events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  projeto_id uuid NULL,
  deal_id uuid NULL,
  proposta_id uuid NULL,
  cliente_id uuid NULL,
  categoria text NULL,
  origem text NOT NULL CHECK (origem IN ('manual','generated','custom_field','checklist_cliente','checklist_instalador','checklist_doc','post_sale','legacy')),
  bucket text NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  checksum text NULL,
  uploaded_by uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_table text NULL,
  source_id uuid NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_documents_unique_storage UNIQUE (bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_pd_tenant_projeto ON public.project_documents(tenant_id, projeto_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pd_tenant_deal ON public.project_documents(tenant_id, deal_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pd_tenant_proposta ON public.project_documents(tenant_id, proposta_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pd_tenant_cliente ON public.project_documents(tenant_id, cliente_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_pd_checksum ON public.project_documents(tenant_id, checksum) WHERE checksum IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pd_source ON public.project_documents(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_pd_origem ON public.project_documents(tenant_id, origem);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_select_tenant" ON public.project_documents;
CREATE POLICY "pd_select_tenant" ON public.project_documents
  FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id'))::uuid OR tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_insert_tenant" ON public.project_documents;
CREATE POLICY "pd_insert_tenant" ON public.project_documents
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_update_tenant" ON public.project_documents;
CREATE POLICY "pd_update_tenant" ON public.project_documents
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "pd_delete_tenant" ON public.project_documents;
CREATE POLICY "pd_delete_tenant" ON public.project_documents
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.tg_project_documents_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_pd_touch ON public.project_documents;
CREATE TRIGGER trg_pd_touch BEFORE UPDATE ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_documents_touch();

-- Eventos / auditoria
CREATE TABLE IF NOT EXISTS public.project_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('upload','replace','delete','restore','download','preview','rename','project_link')),
  actor_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pde_doc ON public.project_document_events(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pde_tenant ON public.project_document_events(tenant_id, created_at DESC);

ALTER TABLE public.project_document_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pde_select_tenant" ON public.project_document_events;
CREATE POLICY "pde_select_tenant" ON public.project_document_events
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "pde_insert_tenant" ON public.project_document_events;
CREATE POLICY "pde_insert_tenant" ON public.project_document_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- ============================================================
-- FASE 2: Projeções não-destrutivas via triggers AFTER
-- Origem permanece intacta. project_documents é espelho.
-- ============================================================

-- Helper: bucket inferido por path do generated_documents (legado usa propostas-pdf/propostas-geradas)
CREATE OR REPLACE FUNCTION public.pd_infer_bucket(p_path text, p_default text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(p_default, ''), 'propostas-geradas')
$$;

-- 2.1 generated_documents → project_documents
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_generated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text; v_bucket text; v_filename text;
BEGIN
  v_path := COALESCE(NEW.pdf_path, NEW.pdf_filled_path, NEW.docx_filled_path);
  IF v_path IS NULL THEN RETURN NEW; END IF;
  v_bucket := CASE WHEN NEW.pdf_path IS NOT NULL OR NEW.pdf_filled_path IS NOT NULL THEN 'propostas-pdf' ELSE 'propostas-geradas' END;
  v_filename := COALESCE(NEW.title, regexp_replace(v_path, '^.*/', ''));

  INSERT INTO public.project_documents (
    tenant_id, projeto_id, deal_id, cliente_id, categoria, origem,
    bucket, storage_path, file_name, mime_type, uploaded_by,
    source_table, source_id, metadata
  ) VALUES (
    NEW.tenant_id, NEW.projeto_id, NEW.deal_id, NEW.cliente_id,
    'Proposta', 'generated',
    v_bucket, v_path, v_filename,
    CASE WHEN v_path ILIKE '%.pdf' THEN 'application/pdf' WHEN v_path ILIKE '%.docx' THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' END,
    COALESCE(NEW.created_by, NEW.updated_by),
    'generated_documents', NEW.id,
    jsonb_build_object('template_id', NEW.template_id, 'status', NEW.status, 'signature_status', NEW.signature_status)
  )
  ON CONFLICT (bucket, storage_path) DO UPDATE
    SET file_name = EXCLUDED.file_name,
        metadata = public.project_documents.metadata || EXCLUDED.metadata,
        updated_at = now(),
        is_deleted = false,
        deleted_at = NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_generated ON public.generated_documents;
CREATE TRIGGER trg_pd_from_generated
  AFTER INSERT OR UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_generated();

CREATE OR REPLACE FUNCTION public.tg_project_docs_from_generated_del()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_documents
     SET is_deleted = true, deleted_at = now()
   WHERE source_table = 'generated_documents' AND source_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_generated_del ON public.generated_documents;
CREATE TRIGGER trg_pd_from_generated_del
  AFTER DELETE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_generated_del();

-- 2.2 post_sale_attachments → project_documents
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_postsale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_filename text;
BEGIN
  IF NEW.storage_path IS NULL THEN RETURN NEW; END IF;
  v_filename := COALESCE(NULLIF(NEW.label, ''), regexp_replace(NEW.storage_path, '^.*/', ''));
  INSERT INTO public.project_documents (
    tenant_id, categoria, origem, bucket, storage_path, file_name,
    source_table, source_id, metadata
  ) VALUES (
    NEW.tenant_id, 'Pós-venda', 'post_sale', 'post_sale_attachments', NEW.storage_path, v_filename,
    'post_sale_attachments', NEW.id, jsonb_build_object('visit_id', NEW.visit_id)
  )
  ON CONFLICT (bucket, storage_path) DO UPDATE
    SET file_name = EXCLUDED.file_name, updated_at = now(), is_deleted = false, deleted_at = NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_postsale ON public.post_sale_attachments;
CREATE TRIGGER trg_pd_from_postsale
  AFTER INSERT OR UPDATE ON public.post_sale_attachments
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_postsale();

CREATE OR REPLACE FUNCTION public.tg_project_docs_from_postsale_del()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_documents SET is_deleted = true, deleted_at = now()
   WHERE source_table = 'post_sale_attachments' AND source_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_postsale_del ON public.post_sale_attachments;
CREATE TRIGGER trg_pd_from_postsale_del
  AFTER DELETE ON public.post_sale_attachments
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_postsale_del();

-- 2.3 doc_checklist_status → project_documents (1 arquivo por item, mas idempotente)
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_doc_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_filename text;
BEGIN
  IF NEW.arquivo_path IS NULL OR NEW.arquivo_path = '' THEN
    -- limpou: marca espelho como deletado
    UPDATE public.project_documents SET is_deleted = true, deleted_at = now()
     WHERE source_table = 'doc_checklist_status' AND source_id = NEW.id;
    RETURN NEW;
  END IF;
  v_filename := regexp_replace(NEW.arquivo_path, '^.*/', '');
  INSERT INTO public.project_documents (
    tenant_id, deal_id, categoria, origem, bucket, storage_path, file_name,
    source_table, source_id, metadata
  ) VALUES (
    NEW.tenant_id, NEW.deal_id, 'Checklist documental', 'checklist_doc',
    'checklist-assets', NEW.arquivo_path, v_filename,
    'doc_checklist_status', NEW.id, jsonb_build_object('item_id', NEW.item_id, 'concluido', NEW.concluido)
  )
  ON CONFLICT (bucket, storage_path) DO UPDATE
    SET file_name = EXCLUDED.file_name, updated_at = now(), is_deleted = false, deleted_at = NULL,
        metadata = public.project_documents.metadata || EXCLUDED.metadata;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_doc_checklist ON public.doc_checklist_status;
CREATE TRIGGER trg_pd_from_doc_checklist
  AFTER INSERT OR UPDATE ON public.doc_checklist_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_doc_checklist();

-- 2.4 checklist_cliente_arquivos → project_documents
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_chk_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text; v_bucket text;
BEGIN
  IF NEW.url IS NULL THEN RETURN NEW; END IF;
  -- url pode ser path ou full URL — guardamos como storage_path (bucket logical)
  v_bucket := 'checklist_cliente';
  v_path := NEW.url;
  INSERT INTO public.project_documents (
    tenant_id, categoria, origem, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by,
    source_table, source_id, metadata
  ) VALUES (
    NEW.tenant_id, COALESCE(NEW.categoria,'Checklist cliente'), 'checklist_cliente',
    v_bucket, v_path, NEW.nome_arquivo, NEW.tipo_mime, NEW.tamanho_bytes, NEW.uploaded_by,
    'checklist_cliente_arquivos', NEW.id, jsonb_build_object('checklist_id', NEW.checklist_id, 'resposta_id', NEW.resposta_id)
  )
  ON CONFLICT (bucket, storage_path) DO UPDATE
    SET file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
        updated_at = now(), is_deleted = false, deleted_at = NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_chk_cliente ON public.checklist_cliente_arquivos;
CREATE TRIGGER trg_pd_from_chk_cliente
  AFTER INSERT OR UPDATE ON public.checklist_cliente_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_chk_cliente();

CREATE OR REPLACE FUNCTION public.tg_project_docs_from_chk_cliente_del()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_documents SET is_deleted = true, deleted_at = now()
   WHERE source_table = 'checklist_cliente_arquivos' AND source_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_chk_cliente_del ON public.checklist_cliente_arquivos;
CREATE TRIGGER trg_pd_from_chk_cliente_del
  AFTER DELETE ON public.checklist_cliente_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_chk_cliente_del();

-- 2.5 checklist_instalador_arquivos → project_documents
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_chk_instalador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.url IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.project_documents (
    tenant_id, categoria, origem, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by,
    source_table, source_id, metadata
  ) VALUES (
    NEW.tenant_id, COALESCE(NEW.categoria,'Checklist instalador'), 'checklist_instalador',
    'checklist_instalador', NEW.url, NEW.nome_arquivo, NEW.tipo_mime, NEW.tamanho_bytes, NEW.uploaded_by,
    'checklist_instalador_arquivos', NEW.id,
    jsonb_build_object('checklist_id', NEW.checklist_id, 'resposta_id', NEW.resposta_id, 'fase', NEW.fase, 'obrigatorio', NEW.obrigatorio)
  )
  ON CONFLICT (bucket, storage_path) DO UPDATE
    SET file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type, size_bytes = EXCLUDED.size_bytes,
        updated_at = now(), is_deleted = false, deleted_at = NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_chk_instalador ON public.checklist_instalador_arquivos;
CREATE TRIGGER trg_pd_from_chk_instalador
  AFTER INSERT OR UPDATE ON public.checklist_instalador_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_chk_instalador();

CREATE OR REPLACE FUNCTION public.tg_project_docs_from_chk_instalador_del()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.project_documents SET is_deleted = true, deleted_at = now()
   WHERE source_table = 'checklist_instalador_arquivos' AND source_id = OLD.id;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_pd_from_chk_instalador_del ON public.checklist_instalador_arquivos;
CREATE TRIGGER trg_pd_from_chk_instalador_del
  AFTER DELETE ON public.checklist_instalador_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_project_docs_from_chk_instalador_del();

-- ============================================================
-- BACKFILL inicial (idempotente — usa ON CONFLICT)
-- ============================================================
INSERT INTO public.project_documents (tenant_id, projeto_id, deal_id, cliente_id, categoria, origem, bucket, storage_path, file_name, mime_type, uploaded_by, source_table, source_id, metadata)
SELECT tenant_id, projeto_id, deal_id, cliente_id, 'Proposta', 'generated',
  CASE WHEN COALESCE(pdf_path, pdf_filled_path) IS NOT NULL THEN 'propostas-pdf' ELSE 'propostas-geradas' END,
  COALESCE(pdf_path, pdf_filled_path, docx_filled_path),
  COALESCE(title, regexp_replace(COALESCE(pdf_path, pdf_filled_path, docx_filled_path), '^.*/', '')),
  CASE WHEN COALESCE(pdf_path, pdf_filled_path) IS NOT NULL THEN 'application/pdf' WHEN docx_filled_path IS NOT NULL THEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' END,
  COALESCE(created_by, updated_by),
  'generated_documents', id,
  jsonb_build_object('template_id', template_id, 'status', status, 'signature_status', signature_status)
FROM public.generated_documents
WHERE COALESCE(pdf_path, pdf_filled_path, docx_filled_path) IS NOT NULL
ON CONFLICT (bucket, storage_path) DO NOTHING;

INSERT INTO public.project_documents (tenant_id, categoria, origem, bucket, storage_path, file_name, source_table, source_id, metadata)
SELECT tenant_id, 'Pós-venda', 'post_sale', 'post_sale_attachments', storage_path,
  COALESCE(NULLIF(label,''), regexp_replace(storage_path, '^.*/', '')),
  'post_sale_attachments', id, jsonb_build_object('visit_id', visit_id)
FROM public.post_sale_attachments WHERE storage_path IS NOT NULL
ON CONFLICT (bucket, storage_path) DO NOTHING;

INSERT INTO public.project_documents (tenant_id, deal_id, categoria, origem, bucket, storage_path, file_name, source_table, source_id, metadata)
SELECT tenant_id, deal_id, 'Checklist documental', 'checklist_doc', 'checklist-assets', arquivo_path,
  regexp_replace(arquivo_path,'^.*/',''), 'doc_checklist_status', id,
  jsonb_build_object('item_id', item_id, 'concluido', concluido)
FROM public.doc_checklist_status WHERE arquivo_path IS NOT NULL AND arquivo_path <> ''
ON CONFLICT (bucket, storage_path) DO NOTHING;

INSERT INTO public.project_documents (tenant_id, categoria, origem, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by, source_table, source_id, metadata)
SELECT tenant_id, COALESCE(categoria,'Checklist cliente'), 'checklist_cliente', 'checklist_cliente', url, nome_arquivo, tipo_mime, tamanho_bytes, uploaded_by,
  'checklist_cliente_arquivos', id, jsonb_build_object('checklist_id', checklist_id, 'resposta_id', resposta_id)
FROM public.checklist_cliente_arquivos WHERE url IS NOT NULL
ON CONFLICT (bucket, storage_path) DO NOTHING;

INSERT INTO public.project_documents (tenant_id, categoria, origem, bucket, storage_path, file_name, mime_type, size_bytes, uploaded_by, source_table, source_id, metadata)
SELECT tenant_id, COALESCE(categoria,'Checklist instalador'), 'checklist_instalador', 'checklist_instalador', url, nome_arquivo, tipo_mime, tamanho_bytes, uploaded_by,
  'checklist_instalador_arquivos', id, jsonb_build_object('checklist_id', checklist_id, 'resposta_id', resposta_id, 'fase', fase, 'obrigatorio', obrigatorio)
FROM public.checklist_instalador_arquivos WHERE url IS NOT NULL
ON CONFLICT (bucket, storage_path) DO NOTHING;
