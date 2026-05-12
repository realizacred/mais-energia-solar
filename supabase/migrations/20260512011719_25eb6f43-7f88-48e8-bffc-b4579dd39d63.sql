-- Update pd_infer_bucket helper
CREATE OR REPLACE FUNCTION public.pd_infer_bucket(p_path text, p_default text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(NULLIF(p_default, ''), 'document-files')
$$;

-- Fix the trigger function to use 'document-files' bucket
CREATE OR REPLACE FUNCTION public.tg_project_docs_from_generated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_path text; v_bucket text; v_filename text;
BEGIN
  v_path := COALESCE(NEW.pdf_path, NEW.pdf_filled_path, NEW.docx_filled_path);
  IF v_path IS NULL THEN RETURN NEW; END IF;
  
  -- Use 'document-files' as the canonical bucket for all generated documents
  v_bucket := 'document-files';
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

-- Update existing incorrect records in project_documents
UPDATE public.project_documents
SET bucket = 'document-files'
WHERE bucket IN ('propostas-pdf', 'propostas-geradas');
